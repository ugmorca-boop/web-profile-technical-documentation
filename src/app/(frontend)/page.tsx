import './tokens.css'

export default function Home() {
  return (
    <main style={{ background: 'var(--surface)', color: 'var(--ink)', minHeight: '100vh', padding: '8rem 1.5rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--step-4)', fontWeight: 400, maxWidth: '11em' }}>
        Robots for the water no one else can reach.
      </h1>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--step-0)', maxWidth: '62ch' }}>
        ORCA is the underwater robotics division of the Gadjah Mada Robotics Team.
      </p>
    </main>
  )
}
