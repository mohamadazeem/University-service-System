export default function PortalIcon({ admin = false }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {admin ? <>
        <path d="M24 5 40 11v12c0 10-9 17-16 20C17 40 8 33 8 23V11L24 5Z" />
        <path d="m17 24 5 5 10-11" />
      </> : <>
        <path d="m4 18 20-9 20 9-20 9L4 18Z" />
        <path d="M12 22v11c7 6 17 6 24 0V22M43 19v14M40 36h6" />
      </>}
    </svg>
  );
}
