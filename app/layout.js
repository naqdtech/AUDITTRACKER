import "./globals.css";

export const metadata = {
  title: "Audit Case Tracker",
  description: "Track each tax-audit case through books, verification, auditor review, 3CD and ITR filing.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
