import Image from "next/image";
import Link from "next/link";
import "./auth.css";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="lc-auth">
      <Link href="/" className="auth-brand">
        <Image
          src="/janet-cares-logo.png"
          alt="Janet Cares"
          width={880}
          height={203}
          priority
        />
      </Link>
      <div className="auth-card">{children}</div>
    </div>
  );
}
