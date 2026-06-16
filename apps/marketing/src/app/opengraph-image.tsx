import { ImageResponse } from 'next/og';
 
export const alt = 'Luxen Digital Innovation';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
 
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#020617', // slate-950
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <div 
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: '#020617',
            backgroundImage: 'radial-gradient(circle at 25px 25px, #f59e0b 2%, transparent 0%), radial-gradient(circle at 75px 75px, #f59e0b 2%, transparent 0%)',
            backgroundSize: '100px 100px',
            opacity: 0.05,
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 80px',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            borderRadius: '24px',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            boxShadow: '0 0 100px rgba(245, 158, 11, 0.1)',
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              letterSpacing: '-0.05em',
            }}
          >
            Luxen<span style={{ color: '#f59e0b' }}>.</span>
          </div>
          <div
            style={{
              marginTop: 30,
              fontSize: 40,
              color: '#94a3b8',
              textAlign: 'center',
              maxWidth: 800,
              lineHeight: 1.4,
              fontWeight: 600,
              letterSpacing: '-0.02em',
            }}
          >
            Driving Digital Innovation
          </div>
          <div style={{ marginTop: 40, display: 'flex' }}>
            <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '10px 20px', borderRadius: '10px', fontSize: '24px', fontWeight: 'bold' }}>
              CLOUD ENGINEERING & B2B SECURITY
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
