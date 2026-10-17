import useAuth from "../auth/useAuth";
export default function Profile() {
  const { user } = useAuth();
  return (
    <main className="page narrow-page">
      <section className="panel form-panel">
        <div className="profile-heading">
          <span className="avatar large-avatar">{user.name.slice(0, 1)}</span>
          <div>
            <p className="eyebrow">{user.role.toUpperCase()} ACCOUNT</p>
            <h1>{user.name}</h1>
          </div>
        </div>
        <dl className="detail-list">
          <dt>Name</dt>
          <dd>{user.name}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Role</dt>
          <dd>{user.role}</dd>
          {user.role === "staff" && <><dt>Service access</dt><dd>All university departments</dd><dt>Staff ID</dt><dd>{user.staffId || "Not provided (existing account)"}</dd><dt>Approval</dt><dd>{user.approvalStatus}</dd></>}
          {user.role !== "staff" && <><dt>Student ID</dt>
          <dd>{user.studentId || "Not provided"}</dd></>}
          <dt>Phone</dt>
          <dd>{user.phone || "Not provided"}</dd>
        </dl>
        <p className="muted">
          Contact your university administrator to update your account
          information.
        </p>
      </section>
    </main>
  );
}
