export default function Home() {
  const hid = process.env.NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID || "";
  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ marginTop: 0 }}>VantDomus Panel</h1>
      <p>
        {hid ? <a href={`/dashboard/${hid}`}>Ir a Dashboard</a> : <span>Falta NEXT_PUBLIC_DEFAULT_HOUSEHOLD_ID</span>}
      </p>
    </div>
  );
}
