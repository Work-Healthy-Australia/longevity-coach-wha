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
          src="/longevity-coach-horizontal-logo.png"
          alt="Longevity Coach"
          width={600}
          height={125}
          priority
        />
      </Link>
      <div className="auth-card">{children}</div>
    </div>
  );
}
