import Image from "next/image";
import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="brand-f">
          <Image
            src="/longevity-coach-horizontal-logo.png"
            alt="Longevity Coach"
            width={900}
            height={188}
          />
        </div>
        <div className="links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <Link href="/legal/data-handling">Data handling</Link>
          <a href="#">Clinical governance</a>
          <a href="#">Contact</a>
        </div>
        <div>© 2026 · LONGEVITY COACH LTD</div>
      </div>
    </footer>
  );
}
