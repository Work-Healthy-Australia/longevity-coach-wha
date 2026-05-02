import Image from "next/image";
import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="brand-f">
          <Image
            src="/janet-cares-logo.png"
            alt="Janet Cares"
            width={880}
            height={203}
          />
        </div>
        <div className="links">
          <Link href="/stories">Stories</Link>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <Link href="/legal/data-handling">Data handling</Link>
          <a href="#">Clinical governance</a>
          <a href="#">Contact</a>
        </div>
        <div>© 2026 · WORK HEALTHY AUSTRALIA PTY LTD</div>
      </div>
    </footer>
  );
}
