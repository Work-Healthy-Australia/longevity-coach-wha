import Image from "next/image";
import Link from "next/link";

export function PublicNav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <Image
            src="/janet-cares-logo.png"
            alt="Janet Cares"
            width={880}
            height={203}
            priority
          />
        </Link>
        <div className="nav-links">
          <Link href="/science">Science</Link>
          <Link href="/team">Team</Link>
        </div>
        <div className="nav-cta">
          <Link className="nav-signin" href="/login">Sign in</Link>
          <Link className="btn btn-primary" href="/signup">Begin</Link>
        </div>
      </div>
    </nav>
  );
}
