import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">

        <div className="flex flex-col md:flex-row gap-8 md:gap-10 items-start">
          {/* Image column */}
          <div className="flex-shrink-0 w-full md:w-80 mx-auto md:mx-0 space-y-6">
            <div className="overflow-hidden rounded-lg border border-[var(--border)]">
              <Image
                src="/media/site/recording-setup-cropped.jpg"
                alt="Rack of TASCAM 122 MK III cassette decks used for digitizing mixtapes"
                width={800}
                height={1200}
                className="w-full h-auto"
                sizes="(max-width: 768px) 100vw, 320px"
                priority
              />
            </div>
            
            {/* Pull quote */}
            <blockquote className="border-l-4 border-[var(--accent)] pl-4 py-2">
              <p className="text-base leading-relaxed text-[var(--text)] italic">
                the sound of a scene before algorithms, streaming platforms, and social media shaped how it circulated
              </p>
            </blockquote>
          </div>

          {/* Text column */}
          <div className="flex-1 space-y-6 text-[var(--text)]">
            <p className="text-base leading-relaxed">
              simfonik began in 2007 as a labor of love. The goal was simple: to preserve and share DJ mixtapes from the early 1990s Los Angeles rave scene, a period that helped define a generation of underground dance music but was largely undocumented online at the time. Many of these recordings existed only on aging cassette tapes, passed hand to hand, with no guarantee they would survive.
            </p>

            <p className="text-base leading-relaxed">
              What started as a small archive of my own collection gradually found an audience. Word spread, and DJs, promoters, and ravers began contributing their own mixes so they could live alongside the others. simfonik became a modest but meaningful record of a specific moment in time, capturing not just music, but the sound of a scene before algorithms, streaming platforms, and social media shaped how it circulated.
            </p>

            <p className="text-base leading-relaxed">
              simfonik exists to preserve these recordings and present them with care and context, as a record of the music and the people who shaped the scene.
            </p>

            <p className="text-base leading-relaxed mt-8">
              Thanks for listening.<br />
              simfonik
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
