"""
structure.py — Org hierarchy management
Mounted at /api/structure

Endpoints:
  Departments: GET/POST/PUT/PATCH/DELETE  /api/structure/departments[/{id}]
  Classes:     GET/POST/PUT/DELETE        /api/structure/classes[/{id}]
  Sections:    GET/POST/PUT/DELETE        /api/structure/sections[/{id}]
  Subjects:    GET/POST/PUT/DELETE        /api/structure/subjects[/{id}]
  Teachers:    GET/POST/DELETE            /api/structure/sections/{id}/teachers
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models import (
    OrgUser, Department, Class, Section, Subject, SectionTeacher, OnboardingStatus,
)
from app.schemas import (
    DepartmentCreate, DepartmentUpdate, DepartmentOut,
    ClassCreate, ClassUpdate, ClassOut, ClassWithSections,
    SectionCreate, SectionUpdate, SectionOut, SectionDetail,
    SubjectCreate, SubjectUpdate, SubjectOut,
    SectionTeacherAssign, SectionTeacherOut,
)
from app.dependencies import get_current_user, require_min_role, AnyRole, AdminOrAbove

router = APIRouter(tags=["structure"])


def _role_str(user: OrgUser) -> str:
    r = user.role
    return r.value if hasattr(r, "value") else str(r)


def _require_admin(current_user: OrgUser):
    if _role_str(current_user) not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")


# ═══════════════════════════════════════════════
# DEPARTMENTS
# ═══════════════════════════════════════════════

@router.get("/departments", response_model=List[DepartmentOut])
async def list_departments(
    is_active: Optional[bool] = Query(True),
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Department).where(Department.organization_id == current_user.organization_id)
    if is_active is not None:
        stmt = stmt.where(Department.is_active == is_active)
    stmt = stmt.order_by(Department.name)
    rows = (await db.execute(stmt)).scalars().all()
    return [DepartmentOut.model_validate(r) for r in rows]


@router.post("/departments", response_model=DepartmentOut, status_code=201)
async def create_department(
    data: DepartmentCreate,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    existing = await db.scalar(
        select(Department).where(
            Department.organization_id == current_user.organization_id,
            Department.code == data.code.upper(),
        )
    )
    if existing:
        raise HTTPException(409, f"Department with code '{data.code}' already exists")

    dept = Department(
        organization_id=current_user.organization_id,
        name=data.name,
        code=data.code.upper(),
        description=data.description,
        head_user_id=data.head_user_id,
    )
    db.add(dept)
    await db.flush()

    # Advance onboarding
    onboard = await db.scalar(
        select(OnboardingStatus).where(OnboardingStatus.organization_id == current_user.organization_id)
    )
    if onboard and not onboard.department_added:
        onboard.department_added = True

    await db.commit()
    await db.refresh(dept)
    return DepartmentOut.model_validate(dept)


@router.get("/departments/{dept_id}", response_model=DepartmentOut)
async def get_department(
    dept_id: int,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    dept = await _get_dept_or_404(dept_id, current_user.organization_id, db)
    return DepartmentOut.model_validate(dept)


@router.put("/departments/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: int,
    data: DepartmentUpdate,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    dept = await _get_dept_or_404(dept_id, current_user.organization_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(dept, field, value)
    await db.commit()
    await db.refresh(dept)
    return DepartmentOut.model_validate(dept)


@router.delete("/departments/{dept_id}", status_code=204)
async def delete_department(
    dept_id: int,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    dept = await _get_dept_or_404(dept_id, current_user.organization_id, db)
    # Soft delete
    dept.is_active = False
    await db.commit()


async def _get_dept_or_404(dept_id: int, org_id: int, db: AsyncSession) -> Department:
    d = await db.scalar(
        select(Department).where(Department.id == dept_id, Department.organization_id == org_id)
    )
    if not d:
        raise HTTPException(404, "Department not found")
    return d


# ═══════════════════════════════════════════════
# CLASSES
# ═══════════════════════════════════════════════

@router.get("/classes", response_model=List[ClassOut])
async def list_classes(
    department_id: Optional[int]  = Query(None),
    is_active:     Optional[bool] = Query(True),
    with_sections: bool           = Query(False),
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Class).where(Class.organization_id == current_user.organization_id)
    if department_id:
        stmt = stmt.where(Class.department_id == department_id)
    if is_active is not None:
        stmt = stmt.where(Class.is_active == is_active)
    stmt = stmt.order_by(Class.name)
    rows = (await db.execute(stmt)).scalars().all()

    if with_sections:
        result = []
        for klass in rows:
            sec_rows = (await db.execute(
                select(Section).where(Section.class_id == klass.id, Section.is_active == True)
                .order_by(Section.name)
            )).scalars().all()
            item = ClassWithSections.model_validate(klass)
            item.sections = [SectionOut.model_validate(s) for s in sec_rows]
            result.append(item)
        return result

    return [ClassOut.model_validate(r) for r in rows]


@router.post("/classes", response_model=ClassOut, status_code=201)
async def create_class(
    data: ClassCreate,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    # Validate department in same org
    await _get_dept_or_404(data.department_id, current_user.organization_id, db)

    klass = Class(
        organization_id=current_user.organization_id,
        department_id=data.department_id,
        name=data.name,
        grade_level=data.grade_level,
        academic_year=data.academic_year,
    )
    db.add(klass)
    await db.flush()

    # Advance onboarding
    onboard = await db.scalar(
        select(OnboardingStatus).where(OnboardingStatus.organization_id == current_user.organization_id)
    )
    if onboard and not onboard.class_added:
        onboard.class_added = True

    await db.commit()
    await db.refresh(klass)
    return ClassOut.model_validate(klass)


@router.get("/classes/{class_id}", response_model=ClassWithSections)
async def get_class(
    class_id: int,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    klass = await _get_class_or_404(class_id, current_user.organization_id, db)
    sec_rows = (await db.execute(
        select(Section).where(Section.class_id == class_id, Section.is_active == True)
        .order_by(Section.name)
    )).scalars().all()

    item = ClassWithSections.model_validate(klass)
    item.sections = [SectionOut.model_validate(s) for s in sec_rows]
    return item


@router.put("/classes/{class_id}", response_model=ClassOut)
async def update_class(
    class_id: int,
    data: ClassUpdate,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    klass = await _get_class_or_404(class_id, current_user.organization_id, db)
    if data.department_id:
        await _get_dept_or_404(data.department_id, current_user.organization_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(klass, field, value)
    await db.commit()
    await db.refresh(klass)
    return ClassOut.model_validate(klass)


@router.delete("/classes/{class_id}", status_code=204)
async def delete_class(
    class_id: int,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    klass = await _get_class_or_404(class_id, current_user.organization_id, db)
    klass.is_active = False
    await db.commit()


async def _get_class_or_404(class_id: int, org_id: int, db: AsyncSession) -> Class:
    c = await db.scalar(
        select(Class).where(Class.id == class_id, Class.organization_id == org_id)
    )
    if not c:
        raise HTTPException(404, "Class not found")
    return c


# ═══════════════════════════════════════════════
# SECTIONS
# ═══════════════════════════════════════════════

@router.get("/sections", response_model=List[SectionDetail])
async def list_sections(
    class_id:   Optional[int]  = Query(None),
    is_active:  Optional[bool] = Query(True),
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Section).where(Section.organization_id == current_user.organization_id)
    if class_id:
        stmt = stmt.where(Section.class_id == class_id)
    if is_active is not None:
        stmt = stmt.where(Section.is_active == is_active)
    stmt = stmt.order_by(Section.name)
    rows = (await db.execute(stmt)).scalars().all()

    result = []
    for s in rows:
        from app.models import Student
        count = await db.scalar(
            select(func.count(Student.id)).where(
                Student.section_id == s.id, Student.is_active == True
            )
        ) or 0
        item = SectionDetail.model_validate(s)
        item.student_count = count
        result.append(item)
    return result


@router.post("/sections", response_model=SectionOut, status_code=201)
async def create_section(
    data: SectionCreate,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    await _get_class_or_404(data.class_id, current_user.organization_id, db)

    section = Section(
        organization_id=current_user.organization_id,
        class_id=data.class_id,
        name=data.name,
        capacity=data.capacity,
        room_no=data.room_no,
        primary_teacher_id=data.primary_teacher_id,
    )
    db.add(section)
    await db.flush()

    # Advance onboarding
    onboard = await db.scalar(
        select(OnboardingStatus).where(OnboardingStatus.organization_id == current_user.organization_id)
    )
    if onboard and not onboard.section_added:
        onboard.section_added = True

    await db.commit()
    await db.refresh(section)
    return SectionOut.model_validate(section)


@router.get("/sections/{section_id}", response_model=SectionDetail)
async def get_section(
    section_id: int,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    section = await _get_section_or_404(section_id, current_user.organization_id, db)
    from app.models import Student
    count = await db.scalar(
        select(func.count(Student.id)).where(
            Student.section_id == section_id, Student.is_active == True
        )
    ) or 0
    item = SectionDetail.model_validate(section)
    item.student_count = count
    return item


@router.put("/sections/{section_id}", response_model=SectionOut)
async def update_section(
    section_id: int,
    data: SectionUpdate,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    section = await _get_section_or_404(section_id, current_user.organization_id, db)
    if data.class_id:
        await _get_class_or_404(data.class_id, current_user.organization_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(section, field, value)
    await db.commit()
    await db.refresh(section)
    return SectionOut.model_validate(section)


@router.delete("/sections/{section_id}", status_code=204)
async def delete_section(
    section_id: int,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    section = await _get_section_or_404(section_id, current_user.organization_id, db)
    section.is_active = False
    await db.commit()


async def _get_section_or_404(section_id: int, org_id: int, db: AsyncSession) -> Section:
    s = await db.scalar(
        select(Section).where(Section.id == section_id, Section.organization_id == org_id)
    )
    if not s:
        raise HTTPException(404, "Section not found")
    return s


# ─────────────────────────────────────────────
# Section → Teacher assignment
# ─────────────────────────────────────────────

@router.get("/sections/{section_id}/teachers", response_model=List[SectionTeacherOut])
async def list_section_teachers(
    section_id: int,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    await _get_section_or_404(section_id, current_user.organization_id, db)
    rows = await db.execute(
        select(SectionTeacher, OrgUser.name.label("teacher_name"))
        .join(OrgUser, OrgUser.id == SectionTeacher.user_id)
        .where(SectionTeacher.section_id == section_id)
        .order_by(SectionTeacher.is_primary.desc(), OrgUser.name)
    )
    result = []
    for row in rows.all():
        out = SectionTeacherOut.model_validate(row.SectionTeacher)
        out.teacher_name = row.teacher_name
        result.append(out)
    return result


@router.post("/sections/{section_id}/teachers", response_model=SectionTeacherOut, status_code=201)
async def assign_teacher(
    section_id: int,
    data: SectionTeacherAssign,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    await _get_section_or_404(section_id, current_user.organization_id, db)

    # Validate teacher is in same org
    teacher = await db.scalar(
        select(OrgUser).where(
            OrgUser.id == data.user_id,
            OrgUser.organization_id == current_user.organization_id,
        )
    )
    if not teacher:
        raise HTTPException(404, "Teacher (user) not found in your organisation")

    existing = await db.scalar(
        select(SectionTeacher).where(
            SectionTeacher.section_id == section_id,
            SectionTeacher.user_id == data.user_id,
            SectionTeacher.subject_id == data.subject_id,
        )
    )
    if existing:
        raise HTTPException(409, "Teacher already assigned to this section/subject")

    st = SectionTeacher(
        section_id=section_id,
        user_id=data.user_id,
        subject_id=data.subject_id,
        is_primary=data.is_primary,
    )
    db.add(st)
    await db.commit()
    await db.refresh(st)

    out = SectionTeacherOut.model_validate(st)
    out.teacher_name = teacher.name
    return out


@router.delete("/sections/{section_id}/teachers/{assignment_id}", status_code=204)
async def remove_teacher(
    section_id: int,
    assignment_id: int,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    st = await db.scalar(
        select(SectionTeacher).where(
            SectionTeacher.id == assignment_id,
            SectionTeacher.section_id == section_id,
        )
    )
    if not st:
        raise HTTPException(404, "Assignment not found")
    await db.delete(st)
    await db.commit()


# ═══════════════════════════════════════════════
# SUBJECTS
# ═══════════════════════════════════════════════

@router.get("/subjects", response_model=List[SubjectOut])
async def list_subjects(
    department_id: Optional[int]  = Query(None),
    is_active:     Optional[bool] = Query(True),
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Subject).where(Subject.organization_id == current_user.organization_id)
    if department_id:
        stmt = stmt.where(Subject.department_id == department_id)
    if is_active is not None:
        stmt = stmt.where(Subject.is_active == is_active)
    stmt = stmt.order_by(Subject.name)
    rows = (await db.execute(stmt)).scalars().all()
    return [SubjectOut.model_validate(r) for r in rows]


@router.post("/subjects", response_model=SubjectOut, status_code=201)
async def create_subject(
    data: SubjectCreate,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    existing = await db.scalar(
        select(Subject).where(
            Subject.organization_id == current_user.organization_id,
            Subject.code == data.code.upper(),
        )
    )
    if existing:
        raise HTTPException(409, f"Subject with code '{data.code}' already exists")

    subject = Subject(
        organization_id=current_user.organization_id,
        department_id=data.department_id,
        name=data.name,
        code=data.code.upper(),
        subject_type=data.subject_type,
    )
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return SubjectOut.model_validate(subject)


@router.get("/subjects/{subject_id}", response_model=SubjectOut)
async def get_subject(
    subject_id: int,
    current_user: OrgUser = AnyRole,
    db: AsyncSession = Depends(get_db),
):
    subject = await _get_subject_or_404(subject_id, current_user.organization_id, db)
    return SubjectOut.model_validate(subject)


@router.put("/subjects/{subject_id}", response_model=SubjectOut)
async def update_subject(
    subject_id: int,
    data: SubjectUpdate,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    subject = await _get_subject_or_404(subject_id, current_user.organization_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(subject, field, value)
    await db.commit()
    await db.refresh(subject)
    return SubjectOut.model_validate(subject)


@router.delete("/subjects/{subject_id}", status_code=204)
async def delete_subject(
    subject_id: int,
    current_user: OrgUser = AdminOrAbove,
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    subject = await _get_subject_or_404(subject_id, current_user.organization_id, db)
    subject.is_active = False
    await db.commit()


async def _get_subject_or_404(subject_id: int, org_id: int, db: AsyncSession) -> Subject:
    s = await db.scalar(
        select(Subject).where(Subject.id == subject_id, Subject.organization_id == org_id)
    )
    if not s:
        raise HTTPException(404, "Subject not found")
    return s
