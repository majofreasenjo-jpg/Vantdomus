import { ImageResponse } from 'next/og';
import { getPostData } from '@/lib/blog';
 
export const alt = 'Luxen Insights';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
 
export default async function Image(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const postInfo = await getPostData(params.slug).catch(() => null);
  
  const title = postInfo ? postInfo.title : 'Luxen Insights Arquitectura y DevOps';
  const category = postInfo ? postInfo.category : 'B2B Engineering';

  return new ImageResponse(
    (
      <div
        style={{
          background: '#020617', // slate-950
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 100px',
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
        
        <div style={{ display: 'flex', marginBottom: 40, alignItems: 'center' }}>
            <span style={{ fontSize: 40, fontWeight: 900, color: 'white', letterSpacing: '-0.05em', marginRight: 20 }}>
              Luxen<span style={{ color: '#f59e0b' }}>.</span>
            </span>
            <span style={{ height: 40, width: 2, backgroundColor: '#334155', marginRight: 20 }}></span>
            <span style={{ fontSize: 30, color: '#f59e0b', fontWeight: 'bold' }}>Insights</span>
        </div>

        <div style={{ display: 'flex', marginBottom: 30 }}>
            <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '10px 20px', borderRadius: '10px', fontSize: '24px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {category}
            </span>
        </div>

        <div
          style={{
            fontSize: 70,
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            maxWidth: '1000px'
          }}
        >
          {title}
        </div>

      </div>
    ),
    {
      ...size,
    }
  );
}
