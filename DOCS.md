# Nexus Attendance — Complete System Guide

> **Version:** April 2026  
> **Platform:** Nexus Attendance SaaS  
> **Supported Organizations:** Schools · Colleges · Offices

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Roles & Access Levels](#2-roles--access-levels)
3. [Getting Started — Registration & Onboarding](#3-getting-started--registration--onboarding)
4. [Super Admin Settings](#4-super-admin-settings)
5. [Organization Management (Departments / Teams)](#5-organization-management-departments--teams)
6. [User Management](#6-user-management)
7. [Section Management](#7-section-management)
8. [Student Management](#8-student-management)
9. [Attendance](#9-attendance)
10. [Analytics & AI Insights](#10-analytics--ai-insights)
11. [Activity Logs](#11-activity-logs)
12. [Permissions & RBAC](#12-permissions--rbac)
13. [Complete System Workflow](#13-complete-system-workflow)
14. [Best Practices & Rules](#14-best-practices--rules)
15. [API Reference](#15-api-reference)

---

## 1. System Overview

Nexus Attendance is a **multi-tenant SaaS** platform for tracking attendance, analyzing trends, and generating AI-driven insights. It supports schools, colleges, and offices from a single codebase, with terminology and structure adapting to the organization type.

### Core Concepts

| Concept | What It Means |
|---|---|
| **Organization** | Your company, school, or college. All data is isolated per organization. |
| **Department / Team / Faculty** | Top-level grouping within your organization (name varies by org type). |
| **Class / Project / Batch** | A sub-group inside a department. |
| **Section / Sub-team / Group** | The smallest unit — attendance is tracked at this level. |
| **User (Staff)** | Admins, teachers, employees who log in and manage attendance. |
| **Student** | Extended profile for learners; linked to a section for attendance. |
| **Role** | Controls what a user can see and do inside the system. |

### Terminology by Organization Type

| Level | School | College | Office |
|---|---|---|---|
| Level 1 | Department | Faculty | Team |
| Level 2 | Class | Batch | Project |
| Level 3 | Section | Group | Sub-team |
| Level 4 | Subject | Course | Task |

> **Note:** These labels are customizable. Go to **Settings → Organization** to rename them for your workspace.

---

## 2. Roles & Access Levels

Nexus uses a **hierarchical RBAC** (Role-Based Access Control) system. Every user is assigned one role. Higher-level roles include all permissions of lower roles.

### Role Hierarchy

```
super_admin (Level 4)  ← Unrestricted access
    └─ admin (Level 3)  ← Manages users, org settings, insights
        └─ staff (Level 2)  ← Marks attendance for sections, views analytics
            └─ user (Level 1)  ← Marks own attendance only
```

### Role Descriptions

| Role | Who It's For | What They Can Do |
|---|---|---|
| **Super Admin** | The account owner who registered the organization | Everything — no restrictions. Manages all settings, roles, permissions, and org structure. |
| **Admin** | Principal, HR manager, department head | Creates users, views all analytics and insights, manages org hierarchy, edits permissions. Cannot create other admins by default. |
| **Staff** | Teachers, supervisors, team leads | Marks attendance for assigned sections, views analytics for their section/department. |
| **User** | Students (staff type), employees | Marks only their own attendance, views personal dashboard. |

### Default Permissions Matrix

| Resource | Super Admin | Admin | Staff | User |
|---|---|---|---|---|
| Attendance — View | ✅ org | ✅ org | ✅ section | ✅ self |
| Attendance — Create | ✅ | ✅ | ✅ | ❌ |
| Students — View | ✅ | ✅ org | ✅ section | ✅ self |
| Students — Create/Edit | ✅ | ✅ | ❌ | ❌ |
| Departments — View | ✅ | ✅ | ✅ | ❌ |
| Departments — Create/Edit | ✅ | ✅ | ❌ | ❌ |
| Analytics — View | ✅ | ✅ org | ✅ section | ❌ |
| AI Insights — View | ✅ | ✅ | ❌ | ❌ |
| AI Insights — Generate | ✅ | ✅ | ❌ | ❌ |
| Users — View | ✅ | ✅ | ✅ section | ❌ |
| Users — Create/Edit | ✅ | ✅ | ❌ | ❌ |
| Permissions — View | ✅ | ✅ | ❌ | ❌ |
| Permissions — Edit | ✅ | ❌ | ❌ | ❌ |

> **Scope meanings:**  
> `org` = access all records in the organization  
> `section` = access only records in assigned sections  
> `self` = access only own records  

> **Important:** These are the built-in defaults. A Super Admin can override any permission from **Settings → Permissions** or the **Permissions** page.

---

## 3. Getting Started — Registration & Onboarding

### Step 1: Register Your Organization

1. Go to the Nexus registration page (`/register`)
2. Fill in:
   - **Full name** — your personal name
   - **Work email** — becomes your login
   - **Password** — minimum 6 characters
3. Click **Continue** → Step 2
4. Enter your **Organization name** (e.g., "Greenfield School" or "Acme Corp")
5. Click **Create workspace**

> On successful registration, you are automatically assigned the **Super Admin** role.

### Step 2: Complete the Setup Wizard

After registration, you will be redirected to the **Onboarding Wizard**:

**Step 1 — Choose Organization Type**

Select the type that matches your organization:

| Type | Best For |
|---|---|
| School | K-12, primary/secondary institutions |
| College | Universities, polytechnics, professional colleges |
| Office | Corporate offices, startups, NGOs |

> Your selection auto-sets the terminology labels. You can change them later in Settings.

**Step 2 — Create Your First Group**

Create the initial structure to get started:

| Field | Required | Description |
|---|---|---|
| Department Name | **Yes** | E.g., "Science", "Engineering", "HR" |
| Class Name | No | E.g., "Grade 10", "Frontend Team" |
| Section Name | No | E.g., "Section A", "Morning Shift" |

> At minimum, provide a Department name. Class and Section can be added later from the **Organization** page.

**Step 3 — Dashboard**

Setup completes and you are redirected to your dashboard automatically.

---

## 4. Super Admin Settings

The **Settings** page is accessible from the sidebar at any time. It is organized into sections:

### 4.1 Profile

**Location:** Settings → Profile

| Setting | Purpose |
|---|---|
| Display Name | Your name shown across the app and in reports |
| Department | The department you belong to (optional) |
| Role badge | Read-only display of your current role level |

> **Use case:** Update your name if it was entered incorrectly during registration.

---

### 4.2 Organization

**Location:** Settings → Organization  
**Access:** Admin and Super Admin only

Controls how Nexus labels your organizational hierarchy.

| Setting | Purpose | Example |
|---|---|---|
| Level 1 Label | Name for the top-level group | "Department", "Faculty", "Team" |
| Level 2 Label | Name for the sub-group | "Class", "Batch", "Project" |
| Level 3 Label | Name for the smallest group | "Section", "Group", "Sub-team" |
| Level 4 Label | Name for subject/course | "Subject", "Course", "Task" |
| Organization Type | Sets default labelling preset | School / College / Office |

> **Use case:** A college that calls its divisions "Schools" and sub-groups "Programs" can rename Level 1 to "School" and Level 2 to "Program". These names appear everywhere in the UI.

> **Important:** Changing labels here does not affect existing data — it only renames how things are displayed.

---

### 4.3 Roles

**Location:** Settings → Roles  
**Access:** Admin and Super Admin only

Create and manage custom roles beyond the 4 built-in ones.

| Field | Purpose |
|---|---|
| Name | Internal identifier (e.g., `class_teacher`) — no spaces, lowercase |
| Label | Display name shown in the UI (e.g., "Class Teacher") |
| Level | Numeric hierarchy level (1–99). Higher = more authority. |
| Description | Optional notes about what this role is for |

> **Built-in role levels:** user=1, staff=2, admin=3, super_admin=4  
> Custom roles can be placed between these levels.

> **Use case:** A school needs a "Class Teacher" role with more access than a regular `staff` but less than `admin`. Create a custom role with level 2–3 and set its permissions from the Permissions page.

> **Deleting a role:** Only custom roles can be deleted. Built-in roles cannot be removed.

---

### 4.4 Notifications

**Location:** Settings → Notifications

Configure which automated alerts you receive:

| Alert | Trigger |
|---|---|
| Low attendance alerts | Attendance drops below 75% |
| Weekly digest email | Summary of trends every Monday |
| Late-arrival alerts | Users arrive more than 30 minutes late |
| Department-level alerts | A department dips below threshold |

> These settings are per-user preferences and do not affect other users.

---

### 4.5 Security

**Location:** Settings → Security  
**Access:** Any logged-in user

Change your password securely:

1. Enter your **current password**
2. Enter a **new password** (minimum 6 characters)
3. **Confirm** the new password
4. Click **Update password**

> **Rules:**
> - Current password must be correct.
> - New password cannot be the same as current (enforce at least 6 chars).
> - All active sessions continue after a password change.

---

### 4.6 Appearance

**Location:** Settings → Appearance  
**Access:** Any user

Switch between **Dark mode** (default) and **Light mode**. The preference is saved in your browser and persists across sessions.

> The theme can also be toggled using the Sun/Moon icon in the top navigation bar.

---

### 4.7 API & MCP

**Location:** Settings → API & MCP  
**Access:** Any user (informational)

Displays the full REST API endpoint reference with HTTP methods and descriptions. All endpoints are **MCP-ready** — they return structured JSON consumable by AI agents.

**Authentication:** Use a Bearer token in the `Authorization` header:
```
Authorization: Bearer <your_access_token>
```

> **Use case:** Developers can connect external tools, dashboards, or AI agents (MCP clients) to the Nexus API using these endpoints.

---

## 5. Organization Management (Departments / Teams)

**Location:** Sidebar → Organization  
**Access:** Admin and Super Admin (view for all with permission)

This page manages the 4-level hierarchy of your organization.

### Structure Overview

```
Organization
└── Department (or Team / Faculty)
    └── Class (or Project / Batch)
        └── Section (or Sub-team / Group)
            ├── Students (learners)
            └── Teachers/Staff (assigned via section)
```

### 5.1 Creating a Department

1. Go to **Organization** in the sidebar
2. Click **+ Add [Department]**
3. Fill in:

| Field | Required | Description |
|---|---|---|
| Name | **Yes** | E.g., "Computer Science", "HR", "Science" |
| Code | **Yes** | Short identifier, auto-uppercased. E.g., "CS", "HR", "SCI". Must be unique. |
| Description | No | Brief notes about this department |

4. Click **Save**

> **Rules:**
> - Each department code must be unique within the organization.
> - A department can have multiple classes under it.
> - Deleting a department removes all its classes and sections (cascade).

---

### 5.2 Creating a Class

A class is a sub-group inside a department.

1. Open a department (click on it)
2. Click **+ Add [Class]**
3. Fill in:

| Field | Required | Description |
|---|---|---|
| Name | **Yes** | E.g., "Grade 10", "Batch 2024", "Backend Team" |
| Academic Year | No | E.g., "2024-25" — for schools/colleges |

4. Click **Save**

> A class name must be unique within its department.

---

### 5.3 Creating a Section

A section is the smallest manageable unit. Attendance is tracked at section level.

1. Open a class
2. Click **+ Add [Section]**
3. Fill in:

| Field | Required | Description |
|---|---|---|
| Name | **Yes** | E.g., "A", "B", "Morning Shift", "Alpha" |
| Capacity | No | Maximum number of students |
| Room No | No | Physical room identifier |
| Primary Teacher | No | Assign a staff member as the homeroom teacher |

4. Click **Save**

> **Important:** Section names must be unique within a class.  
> A section is required before you can create students or mark attendance for a group.

---

### 5.4 Creating a Subject

A subject (or course/task) is linked to a department and can be associated with attendance records.

1. Open a department
2. Click **+ Add [Subject]**
3. Fill in:

| Field | Required | Description |
|---|---|---|
| Name | **Yes** | E.g., "Mathematics", "Physics", "Project Alpha" |
| Code | **Yes** | E.g., "MATH101", "PHY201". Must be unique. |
| Type | No | `theory`, `practical`, or `elective` |

---

### 5.5 Editing & Deleting

- Click the **pencil icon** on any card to edit it
- Click the **trash icon** to delete
- Deletion cascades: deleting a department removes all its classes, sections, and associated data

> **Best practice:** Never delete a department/class if it has active students or attendance records. Deactivate it instead if needed.

---

## 6. User Management

**Location:** Sidebar → Users  
**Access:** Staff (view own dept), Admin and above (view all)

The Users page manages **staff, teachers, and admins** — everyone who logs in to the system. Students are managed separately on the **Students** page.

### 6.1 Viewing Users

- Users are displayed as cards showing name, email, role badge, and department
- Use the **search bar** to filter by name or email
- Use the **role filter** dropdown to show only users of a specific role
- Use the **status filter** to show active or inactive users

> **Scope note:** Staff users only see users in their own department. Admins and Super Admins see all users.

---

### 6.2 Creating a New User

**Who can create:** Staff and above (but they can only assign roles below their own level)

1. Click **+ Add User** (top-right)
2. Fill in the form:

| Field | Required | Notes |
|---|---|---|
| Full Name | **Yes** | Display name |
| Email | **Yes** | Must be unique across all organizations |
| Password | **Yes** | Minimum 6 characters |
| Role | **Yes** | See role table below |
| Department | No | Assign to a department (text field) |
| Employee ID | No | Staff/teacher ID number |
| Phone | No | Contact number |

3. Click **Save**

> **Role assignment rules:**
> - You can only assign roles that are **below your own level**.
> - A `staff` user can create `user` accounts.
> - An `admin` can create `staff` and `user` accounts.
> - Only a `super_admin` can create other `admin` accounts.

---

### 6.3 Roles You Can Assign When Creating a User

| Role | Level | Typical Use |
|---|---|---|
| user | 1 | Basic employee, student staff account |
| staff | 2 | Teacher, supervisor, team lead |
| admin | 3 | Department head, HR manager (super_admin only) |
| super_admin | 4 | Cannot be assigned — only via registration |

---

### 6.4 Editing a User

1. Hover over a user card → click the **pencil icon**
2. Modify the fields (email cannot be changed after creation)
3. Click **Save**

---

### 6.5 Deactivating a User

Clicking the **trash icon** does NOT permanently delete the user. It **deactivates** the account (`is_active = false`).

> **Why soft-delete?** Permanently deleting a user would erase all their attendance history. Deactivation preserves all historical records while preventing login.

To reactivate: use the status filter to find inactive users → edit → toggle active.

---

### 6.6 User Creation — Step-by-Step Example

**Scenario:** Add a new teacher "Priya Sharma" to the Computer Science department.

1. Go to **Users** in the sidebar
2. Click **+ Add User**
3. Enter:
   - Name: `Priya Sharma`
   - Email: `priya.sharma@school.edu`
   - Password: `teacher@2024` (share securely with the user)
   - Role: `staff`
   - Department: `Computer Science`
   - Employee ID: `T-1042`
4. Click **Save**
5. Priya can now log in and mark attendance for her assigned sections

> After creation, assign Priya to her sections from the **Organization** page → open the relevant section → assign her as a section teacher.

---

## 7. Section Management

Sections are the **core attendance unit** in Nexus. Each section contains students and is assigned to teachers.

### Where Sections Are Created

Sections live inside the **Organization hierarchy**:

```
Organization → Department → Class → Section
```

Navigate: **Sidebar → Organization → [Department] → [Class] → Add Section**

### Section Fields Reference

| Field | Required | Description |
|---|---|---|
| Name | **Yes** | "A", "B", "Morning", "Night Shift" |
| Capacity | No | Max number of members |
| Room No | No | Physical room (e.g., "101", "Lab-3") |
| Primary Teacher | No | The homeroom/class teacher |

### Relationship: Section ↔ Users ↔ Students

```
Section
  ├── Students (linked via enrollment)
  │     └── Each student has one active section at a time
  └── Teachers (linked via SectionTeacher)
        └── A teacher can be assigned to multiple sections
        └── A section can have multiple teachers (for different subjects)
```

### How Attendance Links to Sections

When a staff member uses the **Attendance Wizard**, they:
1. Select a section
2. See all students in that section
3. Mark each student present / late / absent / half-day

All records are stored with the section ID, enabling section-level filtering and reports.

---

## 8. Student Management

**Location:** Sidebar → Students  
**Access:** Admin and above (view all); Staff (view their sections)

Students are a special user type with an **extended profile** and a mandatory **section assignment**.

### 8.1 How Students Work

Every student has **two records**:
1. An **OrgUser** record — for login, authentication, and attendance tracking
2. A **Student** record — extended profile with enrollment number, roll number, guardian info, etc.

Both are created together when you add a student from the Students page.

---

### 8.2 Prerequisites Before Creating a Student

Before adding students, you must have:

- [ ] At least one **Department** created
- [ ] At least one **Class** inside that department
- [ ] At least one **Section** inside that class

---

### 8.3 Creating a Student — Step-by-Step

1. Go to **Students** in the sidebar
2. Click **+ Add Student**
3. Fill in the form:

**Basic Info (Required)**

| Field | Required | Description |
|---|---|---|
| Full Name | **Yes** | Student's display name |
| Email | **Yes** | Must be unique. Used for login. |
| Password | **Yes** | Minimum 6 characters |
| Section | **Yes** | Select from available sections. This is the student's home section. |
| Enrollment No | **Yes** | Must be unique within the organization. E.g., "2024-CS-001" |

**Extended Profile (Optional)**

| Field | Description |
|---|---|
| Roll No | Roll number within the section (must be unique per section) |
| Date of Birth | Student's DOB |
| Gender | "male", "female", "other" |
| Guardian Name | Parent or guardian name |
| Guardian Phone | Parent contact number |
| Guardian Email | Parent email address |
| Address | Home address |
| Admission Date | Date of joining |

4. Click **Save**

> The student's login credentials are the email and password you set. Share them securely.

---

### 8.4 Student Validation Rules

| Rule | Detail |
|---|---|
| Unique email | No two users (staff or student) can share the same email |
| Unique enrollment number | Must be unique across your whole organization |
| Unique roll number | Must be unique within their section |
| Section required | A student must be assigned to a section at creation |

---

### 8.5 Filtering and Searching Students

On the Students page:
- **Search** by name or email
- **Filter by section** using the section dropdown
- Inactive students are hidden by default

---

### 8.6 Student Attendance

Students with role `user` can **mark their own attendance** from:
**Attendance page → Mark My Attendance → Select status → Submit**

Staff marking attendance for a section will include all students enrolled in that section via the **Attendance Wizard**.

---

## 9. Attendance

**Location:** Sidebar → Attendance  
**Access:** All roles (scope varies)

### 9.1 Attendance Statuses

| Status | Meaning |
|---|---|
| Present | Fully present and on time |
| Late | Arrived but after the expected time |
| Absent | Did not attend |
| Half Day | Present for only half the session |

---

### 9.2 Marking Attendance — Two Methods

**Method A: Self Mark (Users / Students)**

For users with `user` role:
1. Go to **Attendance**
2. Click **Mark My Attendance**
3. Select status and add optional notes
4. Click **Mark Attendance**

> Can only be done once per day per user. The system uses the current date automatically.

---

**Method B: Section Wizard (Staff / Admin)**

For teachers and admins marking for a whole section:
1. Go to **Attendance**
2. Click **Mark Section**
3. The wizard opens:
   - **Step 1:** Select Section (and optionally subject + period)
   - **Step 2:** Choose date
   - **Step 3:** Set attendance for each student (quick buttons: Present / Late / Absent / Half Day)
4. Click **Submit**

> All records are saved simultaneously in one bulk operation. Each student in the section gets an individual attendance record.

---

### 9.3 Viewing Attendance Records

The Attendance page shows a table of all records visible to you (based on your scope):

| Column | Description |
|---|---|
| Member | Name and department of the person |
| Date | Attendance date |
| Check In | Time of check-in (if recorded) |
| Check Out | Time of check-out (if recorded) |
| Duration | Hours present (if check-in and out both recorded) |
| Section | Which section this record belongs to |
| Status | Present / Late / Absent / Half Day badge |

**Filters available:**
- Search by name
- Filter by status
- Filter by section
- Filter by date range (start date → end date)
- Reset button clears all filters

---

### 9.4 Today's Summary

The attendance page and dashboard both show a **Today's Summary** panel:

| Metric | Description |
|---|---|
| Total Users | Total active members in scope |
| Present | Count marked present today |
| Late | Count marked late today |
| Absent | Count marked absent today |
| Not Marked | Count with no attendance yet today |
| Attendance Rate | Present ÷ Total × 100% |

---

## 10. Analytics & AI Insights

### 10.1 Analytics

**Location:** Sidebar → Analytics  
**Access:** Staff and above

Provides visual reports of attendance trends:

| View | Description |
|---|---|
| Attendance Rate Over Time | Line chart for 7 / 14 / 30-day periods |
| Department Breakdown | Bar chart comparing departments |
| User Performance | Per-member attendance statistics |

Use the **7 Days / 14 Days / 30 Days** buttons to change the time period.

---

### 10.2 AI Insights

**Location:** Sidebar → AI Insights  
**Access:** Admin and Super Admin only

AI Insights are automatically generated alerts based on attendance patterns:

| Severity | Meaning | Example |
|---|---|---|
| Critical | Requires immediate action | "Attendance dropped below 50% today" |
| Warning | Potential issue developing | "User X has been absent 4 days this week" |
| Info | Informational observation | "Department Y has improved 10% this month" |

**Actions:**
- **Generate Insights** — Re-runs the analysis engine to produce fresh insights
- **Mark as Read** — Dismisses an insight from the unread count
- The topbar bell icon shows the count of unread insights

**Dashboard Preview:**
The first 3 unread insights are displayed on the Dashboard for quick access.

---

## 11. Activity Logs

**Location:** Sidebar → Activity Logs  
**Access:** Admin and Super Admin only

A full audit trail of actions performed in the system.

| Column | Description |
|---|---|
| Action | What was done (login, attendance_marked, user_created, etc.) |
| User | Who performed the action |
| Date/Time | Exact timestamp |
| Details | Additional context (email, resource ID, etc.) |

**Logged Actions:**

| Action | Triggered By |
|---|---|
| `login` | Any user logging in |
| `attendance_marked` | Single attendance mark |
| `bulk_attendance_marked` | Section wizard submission |
| `user_created` | New user added |
| `user_updated` | User details edited |
| `user_deleted` | User deactivated |
| `insight_generated` | AI insights re-generated |
| `password_changed` | User changes their password |

**Filters:** Search by user name, filter by action type.

> **Use case:** If you need to investigate who marked attendance at a certain time, or who modified a user account, the Activity Logs provide a complete, immutable trail.

---

## 12. Permissions & RBAC

**Location:** Sidebar → Permissions  
**Access:** Admin and Super Admin (full editing: Super Admin only)

The Permissions page shows a matrix of all roles × resources × actions. You can customize which role gets which permission.

### 12.1 Understanding the Matrix

| Column | Meaning |
|---|---|
| View | Can the role see records for this resource? |
| Create | Can the role add new records? |
| Edit | Can the role modify existing records? |
| Delete | Can the role remove records? |
| Scope | `org` (all data) / `section` (only their section) / `self` (only own data) |

### 12.2 Modifying Permissions

1. Go to **Permissions**
2. Find the role row and resource column
3. Click the toggle cell (green checkmark = allowed, red X = denied)
4. Changes are saved immediately

> **Super Admin users bypass all permission checks** — they always have full access regardless of the matrix settings.

### 12.3 Scope Levels Explained

| Scope | Who Gets It | What It Means |
|---|---|---|
| `org` | Admin, Super Admin | Access every record in the organization |
| `section` | Staff | Access only students/records in their assigned sections |
| `self` | User | Access only their own attendance record |

### 12.4 Custom Roles

Custom roles created in **Settings → Roles** can be added to the permission matrix and given fine-grained access rules, just like built-in roles.

> **Example:** A "Department Head" custom role (level 2.5) could be given `org` scope for analytics but `section` scope for attendance management.

---

## 13. Complete System Workflow

### 13.1 New Organization Setup Flow

```
1. Register
   └─ Creates: Organization + Super Admin account + OnboardingStatus

2. Onboarding Wizard
   ├─ Select org type (School / College / Office)
   └─ Create first department + class + section (optional)

3. Configure Settings
   ├─ Rename hierarchy labels (Settings → Organization)
   └─ Create custom roles if needed (Settings → Roles)

4. Build Org Structure (Organization page)
   ├─ Add remaining departments
   ├─ Add classes to each department
   └─ Add sections to each class

5. Add Users (Users page)
   ├─ Create admin accounts
   ├─ Create staff/teacher accounts
   └─ Assign to departments

6. Assign Teachers to Sections (Organization page)
   └─ Open each section → assign primary teacher

7. Enroll Students (Students page)
   └─ Create student records with section assignment

8. Start Tracking Attendance
   ├─ Staff: use Attendance Wizard to mark sections
   └─ Students/Users: self-mark on Attendance page

9. Monitor with Analytics & Insights
   ├─ View trends on Dashboard and Analytics page
   └─ Check AI Insights for automated alerts
```

---

### 13.2 Day-to-Day Workflow

```
Morning:
  Staff opens Attendance → Click "Mark Section"
  → Select section → Select today's date
  → Mark each student Present / Late / Absent
  → Submit

Admin Dashboard:
  → Views Today's Summary card
  → Checks unread AI Insights (bell icon)
  → Reviews department attendance breakdown

End of Week:
  → Admin runs "Generate Insights" (AI Insights page)
  → Reviews new AI-generated alerts
  → Checks Analytics for weekly trends
  → Reviews Activity Logs for any unusual actions
```

---

### 13.3 User Login Flow

```
User opens app
  → Enters email + password
  → System checks:
       ├─ Is account active?
       ├─ Is password correct?
       └─ Is org still active?
  → On success:
       ├─ Access token + refresh token issued
       ├─ If Admin AND org not yet onboarded → redirect to Onboarding Wizard
       └─ Otherwise → redirect to Dashboard
  → On expiry:
       └─ Access token auto-refreshed using stored refresh token (silent)
```

---

### 13.4 Attendance Marking Decision Tree

```
User clicks "Mark Attendance" button
  │
  ├─ Is the user a Staff or Admin?
  │     └─ YES → "Mark Section" button shown → opens Attendance Wizard
  │                  └─ Select section → date → bulk mark students
  │
  └─ Is the user a basic User / Student?
        └─ YES → "Mark My Attendance" button shown → self-mark modal
                     └─ Select status → notes → submit
```

---

## 14. Best Practices & Rules

### Organization Setup

| Rule | Reason |
|---|---|
| Always create departments before classes | Classes require a parent department |
| Always create classes before sections | Sections require a parent class |
| Always create sections before students | Students must be linked to a section |
| Use unique, meaningful department codes | Codes appear in reports and exports |
| Name sections consistently | "Section A", "Section B" is clearer than "A", "ALPHA" |

### User Management

| Rule | Reason |
|---|---|
| Never delete users — deactivate instead | Deletion removes attendance history permanently |
| Use strong passwords for admin accounts | Admin accounts have high-impact permissions |
| Assign the minimum necessary role | Principle of least privilege — give only what's needed |
| Only Super Admin creates other Admins | Prevents unauthorized privilege escalation |
| Assign staff to sections before marking | Staff scope is section-based; unassigned staff see no data |

### Attendance

| Rule | Reason |
|---|---|
| Only one attendance record per user per day | System enforces this — duplicates are rejected |
| Use the wizard for bulk marking | Much faster than individual marks for a section |
| Check the "Not Marked" count daily | Unmarked users skew attendance rates |
| Add notes for unusual statuses | Helps during audit reviews |

### Security

| Rule | Reason |
|---|---|
| Rotate Super Admin password regularly | High-privilege account — protect it carefully |
| Review Activity Logs weekly | Catch unauthorized actions early |
| Restrict Permissions access to Super Admin | Accidental permission changes can break access control |
| Use custom roles instead of elevating staff to admin | Keeps built-in roles clean and auditable |

---

## 15. API Reference

All API endpoints require a Bearer token unless stated otherwise:
```
Authorization: Bearer <access_token>
```

### Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register new organization + super admin |
| POST | `/api/auth/login` | Public | Login and get tokens (limit: 10/min) |
| POST | `/api/auth/refresh` | Public | Refresh access token (limit: 30/min) |
| GET | `/api/auth/me` | Any | Current user + org info |
| POST | `/api/auth/change-password` | Any | Change own password |
| GET | `/api/auth/org-settings` | Admin+ | Get org type and hierarchy labels |
| PATCH | `/api/auth/org-settings` | Admin+ | Update org type and hierarchy labels |

### Attendance

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/attendance/` | Staff+ | List records (filterable by date, status, section) |
| POST | `/api/attendance/mark` | Any | Mark own attendance |
| POST | `/api/attendance/bulk-mark` | Staff+ | Mark attendance for multiple users at once |
| GET | `/api/attendance/today/summary` | Any | Today's live snapshot counts |

### Structure (Org Hierarchy)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/structure/departments` | Staff+ | List departments |
| POST | `/api/structure/departments` | Admin+ | Create department |
| PUT | `/api/structure/departments/{id}` | Admin+ | Update department |
| DELETE | `/api/structure/departments/{id}` | Admin+ | Delete department |
| GET | `/api/structure/classes` | Staff+ | List classes |
| POST | `/api/structure/classes` | Admin+ | Create class |
| GET | `/api/structure/sections` | Staff+ | List sections |
| POST | `/api/structure/sections` | Admin+ | Create section |
| GET | `/api/structure/subjects` | Staff+ | List subjects |
| POST | `/api/structure/subjects` | Admin+ | Create subject |

### Users & Students

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/users` | Staff+ | List staff users |
| POST | `/api/users` | Staff+ | Create user (role must be below creator's) |
| PUT | `/api/users/{id}` | Admin+ | Update user |
| DELETE | `/api/users/{id}` | Admin+ | Deactivate user (soft-delete) |
| GET | `/api/students` | Staff+ | List students |
| POST | `/api/students` | Admin+ | Create student with profile |
| PUT | `/api/students/{id}` | Admin+ | Update student profile |
| DELETE | `/api/students/{id}` | Admin+ | Deactivate student |

### Analytics

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/analytics/kpis` | Staff+ | Dashboard KPI metrics |
| GET | `/api/analytics/trends` | Staff+ | Attendance trend over time (`?days=14`) |
| GET | `/api/analytics/departments` | Staff+ | Department-level breakdown |
| GET | `/api/analytics/user-performance` | Staff+ | Per-user attendance stats |

### AI Insights

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/insights/` | Admin+ | All AI insights |
| POST | `/api/insights/generate` | Admin+ | Re-run insight engine |
| PATCH | `/api/insights/{id}/read` | Admin+ | Mark insight as read |
| GET | `/api/insights/summary` | Admin+ | Natural-language summary (MCP-ready) |

### Permissions & RBAC

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/permissions/me` | Any | Current user's effective permissions |
| GET | `/api/permissions/roles` | Admin+ | List organization roles |
| POST | `/api/permissions/roles` | Admin+ | Create custom role |
| PUT | `/api/permissions/roles/{id}` | Admin+ | Update role |
| DELETE | `/api/permissions/roles/{id}` | Admin+ | Delete custom role |
| GET | `/api/permissions/role-permissions` | Admin+ | List permission rules |
| POST | `/api/permissions/role-permissions` | Admin+ | Create permission rule |
| PUT | `/api/permissions/role-permissions/{id}` | Admin+ | Update permission rule |
| DELETE | `/api/permissions/role-permissions/{id}` | Admin+ | Delete permission rule |

### Logs & Onboarding

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/logs` | Admin+ | Activity audit log |
| GET | `/api/onboarding/status` | Any | Org setup wizard progress |
| POST | `/api/onboarding/setup` | Admin+ | One-shot org structure setup |
| POST | `/api/onboarding/complete` | Admin+ | Force-mark onboarding as done |

---

## Quick Reference: Who Can Do What

| Task | User | Staff | Admin | Super Admin |
|---|---|---|---|---|
| Mark own attendance | ✅ | ✅ | ✅ | ✅ |
| Mark section attendance | ❌ | ✅ | ✅ | ✅ |
| View own attendance history | ✅ | ✅ | ✅ | ✅ |
| View all attendance | ❌ | Section | ✅ | ✅ |
| View analytics | ❌ | Section | ✅ | ✅ |
| View AI Insights | ❌ | ❌ | ✅ | ✅ |
| Create users | ❌ | User-level | Staff+User | All |
| Create students | ❌ | ❌ | ✅ | ✅ |
| Manage departments/classes | ❌ | ❌ | ✅ | ✅ |
| Edit permissions | ❌ | ❌ | ❌ | ✅ |
| View activity logs | ❌ | ❌ | ✅ | ✅ |
| Change org settings | ❌ | ❌ | ✅ | ✅ |
| Create custom roles | ❌ | ❌ | ✅ | ✅ |
| Delete custom roles | ❌ | ❌ | ✅ | ✅ |
| Create admin accounts | ❌ | ❌ | ❌ | ✅ |

---

*Nexus Attendance · Built with FastAPI + React · MCP-Ready API*
