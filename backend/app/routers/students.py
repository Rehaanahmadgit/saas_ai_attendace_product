"""
students.py — Student registration, listing, section assignment
Mounted at /api/students
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models import OrgUser, Student, Section, Class, Department
from app.schemas import StudentCreate, StudentUpdate, StudentOut, StudentListItem
from app.dependencies import get_current_user, require_permission, AnyRole, _role_str
from app import auth as auth_utils

router = APIRouter(tags=["students"])


@router.get("", response_model=List[StudentListItem])
async def list_students(
    section_id: Optional[int] = Query(None),
    class_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(True),
    search: Optional[str] = Query(None),
    current_user: OrgUser = Depends(require_permission("students", "can_view")),
    db: AsyncSession = Depends(get_db),
):
    """
    List students. Scope:
    - admin/super_admin → whole org
    - staff/teacher → only sections they are assigned to (enforced by caller for now)
    - student → only self
    """
    stmt = (
        select(
            Student.id.label("student_id"),
            Student.user_id,
            OrgUser.name,
            OrgUser.email,
            Student.roll_no,
            Student.enrollment_no,
            Student.section_id,
        )
        .join(OrgUser, OrgUser.id == Student.user_id)
        .where(Student.organization_id == current_user.organization_id)
    )

    # Role-based scoping
    user_role = _role_str(current_user)
    if user_role == "user":
        stmt = stmt.where(Student.user_id == current_user.id)
    else:
        if section_id:
            stmt = stmt.where(Student.section_id == section_id)
        elif class_id:
            stmt = stmt.where(
                Student.section_id.in_(
                    select(Section.id).where(Section.class_id == class_id)
                )
            )
        elif department_id:
            stmt = stmt.where(
                Student.section_id.in_(
                    select(Section.id).join(Class, Class.id == Section.class_id)
                    .where(Class.department_id == department_id)
                )
            )

    if is_active is not None:
        stmt = stmt.where(Student.is_active == is_active)

    if search:
        term = f"%{search.lower()}%"
        stmt = stmt.where(
            OrgUser.name.ilike(term) | Student.enrollment_no.ilike(term) | Student.roll_no.ilike(term)
        )

    stmt = stmt.order_by(Student.roll_no.nullslast(), OrgUser.name)
    result = await db.execute(stmt)
    rows = result.mappings().all()

    return [
        StudentListItem(
            student_id=r["student_id"],
            user_id=r["user_id"],
            name=r["name"],
            email=r["email"],
            roll_no=r["roll_no"],
            enrollment_no=r["enrollment_no"],
            section_id=r["section_id"],
        )
        for r in rows
    ]


@router.post("", response_model=StudentOut, status_code=status.HTTP_201_CREATED)
async def register_student(
    data: StudentCreate,
    current_user: OrgUser = Depends(require_permission("students", "can_create")),
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new student:
    1. Creates OrgUser (login account, role=user, user_type=student)
    2. Creates Student profile linked to that user
    """
    # Validate section is in same org
    section = await db.scalar(
        select(Section).where(
            Section.id == data.section_id,
            Section.organization_id == current_user.organization_id,
        )
    )
    if not section:
        raise HTTPException(404, "Section not found in your organization")

    # Check email uniqueness
    if await db.scalar(select(OrgUser).where(OrgUser.email == data.email.lower())):
        raise HTTPException(409, "Email already registered")

    # Check enrollment number uniqueness in org
    if await db.scalar(
        select(Student).where(
            Student.organization_id == current_user.organization_id,
            Student.enrollment_no == data.enrollment_no,
        )
    ):
        raise HTTPException(409, f"Enrollment number '{data.enrollment_no}' already exists")

    # 1. Create login user
    org_user = OrgUser(
        organization_id=current_user.organization_id,
        name=data.name,
        email=data.email.lower(),
        password_hash=auth_utils.hash_password(data.password),
        role="user",
        user_type="student",
    )
    db.add(org_user)
    await db.flush()   # get org_user.id

    # 2. Create student profile
    student = Student(
        user_id=org_user.id,
        organization_id=current_user.organization_id,
        section_id=data.section_id,
        enrollment_no=data.enrollment_no,
        roll_no=data.roll_no,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        guardian_name=data.guardian_name,
        guardian_phone=data.guardian_phone,
        guardian_email=data.guardian_email,
        address=data.address,
        admission_date=data.admission_date,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)

    out = StudentOut.model_validate(student)
    out.name = org_user.name
    out.email = org_user.email
    return out


@router.get("/{student_id}", response_model=StudentOut)
async def get_student(
    student_id: int,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    row = await _get_student_with_user(student_id, current_user.organization_id, db)
    student, org_user = row

    # Students can only view themselves
    user_role = _role_str(current_user)
    if user_role == "user" and student.user_id != current_user.id:
        raise HTTPException(403, "You can only view your own profile")

    out = StudentOut.model_validate(student)
    out.name = org_user.name
    out.email = org_user.email
    return out


@router.put("/{student_id}", response_model=StudentOut)
async def update_student(
    student_id: int,
    data: StudentUpdate,
    current_user: OrgUser = Depends(require_permission("students", "can_edit")),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_student_with_user(student_id, current_user.organization_id, db)
    student, org_user = row

    # Validate new section if provided
    if data.section_id:
        sec = await db.scalar(
            select(Section).where(
                Section.id == data.section_id,
                Section.organization_id == current_user.organization_id,
            )
        )
        if not sec:
            raise HTTPException(404, "Section not found in your organization")

    update_data = data.model_dump(exclude_none=True)

    # Update OrgUser name if provided
    if "name" in update_data:
        org_user.name = update_data.pop("name")

    for field, value in update_data.items():
        setattr(student, field, value)

    await db.commit()
    await db.refresh(student)
    await db.refresh(org_user)

    out = StudentOut.model_validate(student)
    out.name = org_user.name
    out.email = org_user.email
    return out


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: int,
    current_user: OrgUser = Depends(require_permission("students", "can_delete")),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete — deactivates both Student and OrgUser."""
    row = await _get_student_with_user(student_id, current_user.organization_id, db)
    student, org_user = row
    student.is_active = False
    org_user.is_active = False
    await db.commit()


@router.post("/{student_id}/transfer", response_model=StudentOut)
async def transfer_student(
    student_id: int,
    section_id: int,
    current_user: OrgUser = Depends(require_permission("students", "can_edit")),
    db: AsyncSession = Depends(get_db),
):
    """Transfer student to a different section."""
    row = await _get_student_with_user(student_id, current_user.organization_id, db)
    student, org_user = row

    sec = await db.scalar(
        select(Section).where(
            Section.id == section_id,
            Section.organization_id == current_user.organization_id,
        )
    )
    if not sec:
        raise HTTPException(404, "Target section not found")

    student.section_id = section_id
    await db.commit()
    await db.refresh(student)

    out = StudentOut.model_validate(student)
    out.name = org_user.name
    out.email = org_user.email
    return out


async def _get_student_with_user(
    student_id: int, org_id: int, db: AsyncSession
) -> tuple[Student, OrgUser]:
    result = await db.execute(
        select(Student, OrgUser)
        .join(OrgUser, OrgUser.id == Student.user_id)
        .where(
            Student.id == student_id,
            Student.organization_id == org_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "Student not found")
    return row.Student, row.OrgUser