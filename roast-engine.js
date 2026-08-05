/*
 * roast-engine.js
 * Pure, deterministic roast generator. No LLM, no API key, no network.
 * Takes normalized GitHub data and returns { score, verdict, roasts[], stats[], glowups[] }.
 *
 * Design goal: every line is triggered by a REAL signal in the data, so the roast
 * feels personal and accurate instead of generic. That accuracy is what makes it shareable.
 */

const RoastEngine = (() => {
  const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 100));
  const yearsBetween = (iso) => {
    // Uses Date only for age math; safe in the browser runtime.
    const then = new Date(iso).getTime();
    return (Date.now() - then) / (1000 * 60 * 60 * 24 * 365.25);
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Language-specific jabs.
  const LANG_JAB = {
    JavaScript: "Your top language is JavaScript, so half your repos are just `node_modules` in a trench coat.",
    TypeScript: "TypeScript main. You added types to a to-do app and called it enterprise-grade.",
    Python: "Python everywhere. At this point `import` is your entire personality.",
    Java: "Java is your #1 language. Somewhere a `AbstractSingletonProxyFactoryBean` is proud of you.",
    "C++": "C++ main. You segfault in your sleep and call it a lifestyle.",
    C: "C main. You could've used a library but you wanted to *suffer*.",
    HTML: "GitHub says your top language is HTML. My guy, that's not a programming language, that's a diploma.",
    CSS: "Your most-used language is CSS. Centered a div once and never emotionally recovered.",
    Jupyter: "Jupyter Notebook main. Your 'ML career' is 40 cells and 12 of them are `df.head()`.",
    "Jupyter Notebook": "Jupyter Notebook main. Your 'ML career' is 40 cells and 12 of them are `df.head()`.",
    Go: "Go main. You rewrote a bash script in Go and told everyone about it for a week.",
    Rust: "Rust main. We know. You've mentioned it. Twice. In this sentence.",
    PHP: "PHP in " + (new Date().getFullYear()) + ". Bold. Genuinely inspiring, in a concerning way.",
    Shell: "Your top language is Shell. Your whole GitHub is one `curl | bash` away from disaster.",
    Ruby: "Ruby main. It's 2015 in your heart and honestly? Respect.",
    Dart: "Dart main. You will tell people you 'do Flutter' before they ask.",
    Kotlin: "Kotlin main, aka Java for people who read one Medium article.",
    Swift: "Swift main. You have three half-finished iOS apps and zero on the App Store.",
    Vue: "Vue main in a React world. The hipster of frameworks.",
  };

  function analyze(data) {
    const { user, repos } = data;
    const roasts = [];
    const glowups = [];
    let score = 55; // start neutral-ish, adjust by signals. Higher = more roastable.

    const originals = repos.filter((r) => !r.fork);
    const forks = repos.filter((r) => r.fork);
    const totalStars = originals.reduce((s, r) => s + r.stargazers_count, 0);
    const topRepo = [...originals].sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
    const noDesc = originals.filter((r) => !r.description || !r.description.trim());
    const now = Date.now();
    const staleRepos = originals.filter(
      (r) => r.pushed_at && (now - new Date(r.pushed_at).getTime()) > 1000 * 60 * 60 * 24 * 365
    );
    const accountAge = user.created_at ? yearsBetween(user.created_at) : 0;

    // --- Language tally ---
    const langCount = {};
    originals.forEach((r) => { if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1; });
    const topLang = Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]?.[0];

    // --- Signal: empty account ---
    if (repos.length === 0) {
      return {
        score: 40,
        verdict: "There's... nothing here. You made a GitHub account and then chose violence against yourself.",
        roasts: [
          "Zero public repos. Your GitHub is a parking lot with no cars, just vibes.",
          "This is the developer equivalent of a LinkedIn with 'Open to work' and no experience.",
          "The green squares are so empty NASA is using them to study dark matter.",
        ],
        stats: buildStats(user, repos, totalStars, forks.length),
        glowups: [
          "Ship literally one thing. A calculator. A to-do app. Anything with a README.",
          "Set up a profile README so your page isn't a blank stare.",
          "Push code 3 days in a row. Momentum beats motivation.",
        ],
      };
    }

    // --- Followers / following ratio ---
    if (user.following > 30 && user.following > user.followers * 3) {
      roasts.push(
        `You follow ${user.following} people and ${user.followers} follow you back. That's not networking, that's a hostage situation.`
      );
      score += 8;
      glowups.push("Stop follow-farming. Ship something people follow you *for*.");
    } else if (user.followers > 500) {
      roasts.push(`${user.followers} followers. Okay, GitHub-famous, why are you even here getting roasted?`);
      score -= 6;
    }

    // --- Stars reality check ---
    if (originals.length >= 5 && totalStars <= 3) {
      roasts.push(
        `${originals.length} original repos, ${totalStars} total star${totalStars === 1 ? "" : "s"}. The only person who's seen your code is the one who wrote it. Hi.`
      );
      score += 10;
    } else if (originals.length >= 8 && totalStars < originals.length) {
      roasts.push(
        `You average less than one star per repo. Even your bots gave up.`
      );
      score += 7;
    } else if (totalStars > 1000) {
      roasts.push(`${totalStars.toLocaleString()} stars. Fine, you're actually good. Annoying, but good.`);
      score -= 12;
    }

    if (topRepo && topRepo.stargazers_count >= 50) {
      glowups.push(`"${topRepo.name}" is your hit (${topRepo.stargazers_count}★). Milk it: better README, demo GIF, pinned.`);
    }

    // --- Forks ---
    if (repos.length >= 6 && pct(forks.length, repos.length) >= 50) {
      roasts.push(
        `${pct(forks.length, repos.length)}% of your repos are forks. You didn't build a portfolio, you built a museum of other people's work.`
      );
      score += 9;
      glowups.push("Delete or archive dead forks. A clean profile reads as a focused one.");
    }

    // --- Missing descriptions ---
    if (originals.length >= 4 && pct(noDesc.length, originals.length) >= 50) {
      roasts.push(
        `${noDesc.length} of your repos have no description. 'What does it do?' 'Idk bro, click and find out.'`
      );
      score += 6;
      glowups.push("Add a one-line description to every repo. Takes 20 seconds, doubles clicks.");
    }

    // --- Stale graveyard ---
    if (staleRepos.length >= 4) {
      roasts.push(
        `${staleRepos.length} repos haven't been touched in over a year. Your GitHub has more abandoned projects than a startup incubator.`
      );
      score += 7;
      glowups.push("Archive stale repos (the little archive button). It signals intent, not neglect.");
    }

    // --- Cursed repo names ---
    const cursed = originals.filter((r) =>
      /^(test|test\d*|untitled|new|new-repo|hello-world|helloworld|my-first|myfirst|project\d*|demo|temp|tmp|asdf|abc|repo\d*)$/i.test(r.name)
    );
    if (cursed.length > 0) {
      roasts.push(
        `You have a repo literally named "${cursed[0].name}". The naming creativity of a Windows screenshot.`
      );
      score += 5;
    }

    // --- "learning" energy ---
    const learning = originals.filter((r) => /learn|tutorial|course|practice|udemy|bootcamp|100days/i.test(r.name + " " + (r.description || "")));
    if (learning.length >= 3) {
      roasts.push(
        `${learning.length} repos with 'learning/tutorial/practice' in them. Perpetual student energy. When does the ship happen?`
      );
      score += 5;
      glowups.push("Turn one tutorial repo into an original project. Recruiters can tell the difference.");
    }

    // --- Language jab ---
    if (topLang && LANG_JAB[topLang]) {
      roasts.push(LANG_JAB[topLang]);
      score += 3;
    }

    // --- Bio ---
    if (!user.bio || !user.bio.trim()) {
      roasts.push("No bio. Mysterious. Or you just couldn't think of a single interesting thing about yourself. Brutal either way.");
      score += 3;
      glowups.push("Write a 1-line bio. 'I build X with Y' beats an empty void.");
    } else if (/passionate|ninja|guru|rockstar|10x|synergy|disrupt/i.test(user.bio)) {
      roasts.push(`Your bio says "${truncate(user.bio, 60)}". The buzzword density is giving 2014 LinkedIn.`);
      score += 4;
    }

    // --- Account age vs output ---
    if (accountAge >= 4 && originals.length <= 3) {
      roasts.push(
        `${Math.floor(accountAge)} years on GitHub, ${originals.length} original repo${originals.length === 1 ? "" : "s"}. You've been 'getting into coding' since the last console generation.`
      );
      score += 8;
    }

    // --- Profile README flex/miss ---
    const hasProfileReadme = repos.some((r) => r.name.toLowerCase() === (user.login || "").toLowerCase());
    if (!hasProfileReadme) {
      glowups.push(`Create a repo named "${user.login}" with a README.md for a profile landing page. Instant polish.`);
    }

    // --- Pinned/hit fallback glowups ---
    if (glowups.length < 3) {
      glowups.push("Add a demo GIF to your best repo's README. A moving screenshot outperforms 1,000 words.");
    }
    if (glowups.length < 3) {
      glowups.push("Pin your 3 best repos so the first thing people see is your ceiling, not your floor.");
    }

    // Clamp
    score = Math.max(1, Math.min(100, Math.round(score)));

    // Ensure we always have punchlines
    if (roasts.length < 3) {
      const filler = [
        "Honestly? Not enough red flags to roast properly. Suspicious. Nobody's this clean.",
        "Your GitHub is so tidy it's boring. Go take a risk, ship something weird.",
        `Only ${repos.length} repos total. You're not a developer, you're a developer *sampler*.`,
      ];
      while (roasts.length < 3) roasts.push(filler.shift() || pick(filler));
    }

    return {
      score,
      verdict: verdictFor(score),
      roasts: roasts.slice(0, 6),
      stats: buildStats(user, repos, totalStars, forks.length),
      glowups: dedupe(glowups).slice(0, 4),
    };
  }

  function buildStats(user, repos, totalStars, forkCount) {
    return [
      { n: repos.length, l: "repos" },
      { n: totalStars.toLocaleString(), l: "stars earned" },
      { n: user.followers ?? 0, l: "followers" },
      { n: forkCount, l: "forks" },
    ];
  }

  function verdictFor(score) {
    if (score >= 85) return "🚨 Certified GitHub Disaster. This profile needs a first responder, not a code review.";
    if (score >= 70) return "🔥 Rough. Recruiters open this tab and quietly close it.";
    if (score >= 55) return "😬 Mid. There's potential buried under the graveyard of half-finished repos.";
    if (score >= 40) return "🙂 Not bad, actually. A few fixes and you'd look genuinely sharp.";
    return "😎 Annoyingly solid. Hard to roast. You may leave with your dignity.";
  }

  const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const dedupe = (arr) => [...new Set(arr)];

  return { analyze };
})();

// Expose for both browser and (optional) node testing.
if (typeof module !== "undefined" && module.exports) module.exports = RoastEngine;
