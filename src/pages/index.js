import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className="container">
      <Head>
        <title>Discord Bot Template</title>
        <meta name="description" content="Discord Bot Template with Next.js and discord.js" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="main">
        <h1 className="title">
          Welcome to <a href="https://discord.js.org/">Discord.js</a> Bot Template!
        </h1>

        <p className="description">
          Get started by editing{' '}
          <code>src/bot/index.js</code>
        </p>

        <div className="grid">
          <a href="https://discord.js.org/docs" className="card">
            <h2>Discord.js Documentation &rarr;</h2>
            <p>Find in-depth information about Discord.js features and API.</p>
          </a>

          <a href="https://nextjs.org/docs" className="card">
            <h2>Next.js Documentation &rarr;</h2>
            <p>Find in-depth information about Next.js features and API.</p>
          </a>

          <a
            href="https://ngrok.com/docs"
            className="card"
          >
            <h2>Ngrok Documentation &rarr;</h2>
            <p>Learn about Ngrok for creating secure tunnels to your local server.</p>
          </a>

          <a
            href="https://collab.land/"
            className="card"
          >
            <h2>Collab.Land &rarr;</h2>
            <p>
              Learn about Collab.Land Account Kit integration.
            </p>
          </a>
        </div>
      </main>

      <footer className="footer">
        <a
          href="https://discord.js.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by Discord.js and Next.js
        </a>
      </footer>
    </div>
  );
}
