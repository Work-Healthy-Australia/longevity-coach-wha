import Image from "next/image";
import Link from "next/link";

export function PublicNav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <Image
            src="/longevity-coach-horizontal-logo.png"
            alt="Longevity Coach"
            width={900}
            height={188}
            priority
          />
        </Link>
        <div className="nav-links">
          <Link href="/science">Science</Link>
          <Link href="/team">Team</Link>
          <Link href="/stories">Stories</Link>
        </div>
        <div className="nav-cta">
          <Link className="btn btn-ghost" href="/login">Sign in</Link>
          <Link className="btn btn-primary" href="/signup">Get my bio-age</Link>
        </div>
      </div>
    </nav>
  );
}
