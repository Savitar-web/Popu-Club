export default function Footer() {
  return (
    <>
      <style>{`
        .main-footer {
          background: var(--header);
          color: white;
          text-align: center;
          padding: 28px 20px 32px;
          margin-top: 50px;
        }

        .main-footer p {
          margin: 0 0 1px 0;
          font-size: 1.05rem;
          letter-spacing: 0.5px;
        }

        .social-icons {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 28px;
          flex-wrap: wrap;
        }

        .social-icons a {
          display: inline-block;
          transition: transform 0.3s ease;
        }

        .social-icons a:hover {
          transform: scale(1.15) translateY(-4px);
        }

        .social-icons img {
          width: 90px;
          height: auto;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
        }

        @media (max-width: 500px) {
          .social-icons {
            gap: 16px;
          }
          .social-icons img {
            width: 72px;
          }
          .main-footer p {
            font-size: 0.95rem;
          }
        }
      `}</style>

      <footer className="main-footer">
        <p>© Popu-Club 2024 por Cherry Bless</p>
        <div className="social-icons">
          <a href="https://www.instagram.com/thecherrybless/" target="_blank" rel="noreferrer">
            <img src="/iconitos/nubes, insta, kofi, discord/insta.png" alt="Instagram" />
          </a>
          <a href="https://discord.com/invite/4auZNxgeFF" target="_blank" rel="noreferrer">
            <img src="/iconitos/nubes, insta, kofi, discord/discord.png" alt="Discord" />
          </a>
          <a href="https://ko-fi.com/cherrybless" target="_blank" rel="noreferrer">
            <img src="/iconitos/nubes, insta, kofi, discord/kofi.png" alt="Ko-fi" />
          </a>
        </div>
      </footer>
    </>
  )
}