export default function Footer() {
  return (
    <>
      <style>{`
        .main-footer {
          background: var(--header);
          color: white;
          text-align: center;
          padding: 36px 20px 40px;
          margin-top: 48px;
        }

        .main-footer p {
          margin: 0 0 22px 0;
          font-size: 1.15rem;
          letter-spacing: 0.4px;
          line-height: 1.4;
          opacity: 0.95;
        }

        .social-icons {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 36px;
          flex-wrap: wrap;
        }

        .social-icons a {
          display: inline-block;
          transition: transform 0.28s ease, filter 0.28s ease;
          line-height: 0;
        }

        .social-icons a:hover {
          transform: scale(1.08) translateY(-3px);
          filter: brightness(1.05);
        }

        .social-icons img {
          width: 150px;
          height: auto;
          max-width: 42vw;
          filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.35));
        }

        @media (max-width: 600px) {
          .main-footer {
            padding: 28px 16px 32px;
            margin-top: 36px;
          }

          .main-footer p {
            font-size: 1.05rem;
            margin-bottom: 18px;
          }

          .social-icons {
            gap: 20px;
          }

          .social-icons img {
            width: 125px;
            max-width: 40vw;
          }
        }

        @media (min-width: 900px) {
          .social-icons img {
            width: 170px;
          }

          .main-footer p {
            font-size: 1.2rem;
          }
        }
      `}</style>

      <footer className="main-footer">
        <p>© Popu-Club 2026 por Cherry Bless</p>

        <div className="social-icons">
          <a
            href="https://www.instagram.com/thecherrybless/"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram de Cherry Bless"
          >
            <img
              src="/iconitos/nubes, insta, kofi, discord/insta.webp"
              alt="Síguenos en Instagram"
            />
          </a>

          <a
            href="https://ko-fi.com/cherrybless"
            target="_blank"
            rel="noreferrer"
            aria-label="Apóyanos en Ko-fi"
          >
            <img
              src="/iconitos/nubes, insta, kofi, discord/kofi.webp"
              alt="Apóyanos en Ko-fi"
            />
          </a>
        </div>
      </footer>
    </>
  )
}