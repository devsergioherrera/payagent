// A template re-mounts on every navigation, so each screen enters with the page-transition animation.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition flex min-h-0 flex-1 flex-col">{children}</div>;
}
