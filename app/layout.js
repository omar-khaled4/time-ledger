export const metadata = {
  title: "Time Ledger",
  description: "Attendance, overtime, and salary tracker",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0 }} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
