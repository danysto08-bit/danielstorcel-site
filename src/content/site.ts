export type Lang = 'en' | 'sk';

const destinations: { id: string; name: string; skName?: string; bearing: number; km: number; mark?: 'home' | 'climbed' }[] = [
  { id: 'chamonix', name: 'Chamonix', bearing: 1.8, km: 10.1 },
  { id: 'matterhorn', name: 'Matterhorn', bearing: 75.1, km: 63 },
  { id: 'monterosa', name: 'Monte Rosa', bearing: 81.1, km: 78 },
  { id: 'traunstein', name: 'Traunstein', bearing: 64.3, km: 576, mark: 'climbed' },
  { id: 'vienna', name: 'Vienna', skName: 'Viedeň', bearing: 66.4, km: 767 },
  { id: 'bratislava', name: 'Bratislava', bearing: 68, km: 818, mark: 'home' },
  { id: 'palermo', name: 'Palermo', bearing: 145.7, km: 1011 },
  { id: 'gerlach', name: 'Gerlachovský štít', bearing: 64.8, km: 1062, mark: 'climbed' },
];
const contactPoints = (lang: Lang) => destinations.map(({ skName, ...point }) => ({
  ...point, name: lang === 'sk' ? skName || point.name : point.name,
}));

export interface SiteContent {
  htmlLang: string;
  title: string;
  description: string;
  nav: { about: string; record: string; work: string; research: string; summit: string; skills: string; experience: string; contact: string };
  cvHref: string;
  cvLabel: string;
  cvLabelPdf: string;
  hero: {
    eyebrow: string;
    nameFirst: string;
    nameLast: string;
    intro: string; // supports <b>
    tags: string[];
    photoAlt: string;
    primaryCta: string;
    ghostCta: string;
    ticker: string[];
  };
  about: {
    index: string;
    title: string;
    statement: string;
    interests: { label: string; tag: string }[];
    paragraph2: string;
    traits: string[];
    photoAlt: string;
    photoCaption: string;
  };
  sections: {
    record: { index: string; title: string };
    work: { index: string; title: string };
    research: { index: string; title: string };
    summit: { index: string; title: string };
    skills: { index: string; title: string };
    experience: { index: string; title: string };
  };
  record: {
    intro: string;
    items: {
      stat: string;
      title: string;
      desc: string;
      bullets: string[]; // supports <b>
      photoAlt?: string;
    }[];
  };
  work: {
    intro: string;
    stages: { idea: string; concept: string; prototype: string; live: string };
    score: { value: string; label: string }[];
    tileCopy: {
      aimtoruContradiction: string; aimtoruFacts: string; mountainsTags: string[];
      taroCaption: string; grynadeLine: string; grynadeLikes: string; carbonLabel: string;
    };
    items: {
      name: string;
      status: string;
      tile: 'carbontrail' | 'aimtoru' | 'grynade' | 'taro' | 'mountains';
      stage: 'idea' | 'concept' | 'prototype' | 'live';
      desc: string;
      part: string; // supports <b>
      skills: string[];
      link?: { href: string; label: string };
    }[];
  };
  research: {
    quote: string;
    spec: { label: string; value: string }[];
    fib: { size: string; current: string }[];
    steps: { title: string; desc: string }[];
    linkHref: string;
    linkLabel: string;
    linkNote: string;
    layers: { cu: string; sic: string; zno: string };
    scope: {
      parts: {
        chamber: string; eColumn: string; iColumn: string; tilt: string;
        detector: string; edx: string; stage: string; sample: string;
        beamE: string; beamI: string; trench: string; scale: string;
      };
      phases: [string, string, string, string];
    };
  };
  summit: {
    sub: string;
    peaks: { name: string; alt: string; tag: string; coords: string; status: string }[];
    photoCaptions: string[];
    photoAlts: string[];
    stats: { value: string; label: string }[];
    prep: string[];
    partners: string; // supports <b>
    ascentLabel: string;
    keepScrolling: string;
    route: { label: string; points: string[] };
    hud: { peak: string; altitude: string; climbed: string; goal: string };
    emptyFrame: { title: string; note: string };
    credit: string;
  };
  skills: {
    count: string;
    sub: string;
    groups: { id: string; label: string; items: string[] }[];
    hud: { of: string; skills: string; current: string; hint: string; chapters: string };
  };
  experience: { role: string; title: string; desc: string }[];
  contact: {
    index: string;
    headline: [string, string];
    sub: string;
    signpost: { tags: { write: string; follow: string; pdf: string; home: string; climbed: string }; places: ReturnType<typeof contactPoints>; hint: string };
    weather: { label: string; wind: string; codes: { clear: string; partly: string; cloudy: string; fog: string; drizzle: string; rain: string; snow: string; showers: string; storm: string } };
    built: string;
    email: string;
    instagram: string;
    instagramUrl: string;
    copied: string;
    backToTop: string;
    footerName: string;
    footerPlace: string;
  };
  langSwitch: { en: string; sk: string };
}

export const content: Record<Lang, SiteContent> = {
  en: {
    htmlLang: 'en',
    title: 'Daniel Štorcel',
    description:
      "Daniel Štorcel — final-year student in Bratislava. Top 5 in critical thinking, research at the Slovak Academy of Sciences, founder projects, and a mountain that isn’t climbed yet.",
    nav: { about: 'About', record: 'Record', work: 'Work', research: 'Research', summit: 'Summit', skills: 'Skills', experience: 'Résumé', contact: 'Contact' },
    cvHref: '/daniel-storcel-cv-en.pdf',
    cvLabel: 'CV ↓',
    cvLabelPdf: 'Download CV (PDF)',
    hero: {
      eyebrow: 'Bratislava, Slovakia — final year',
      nameFirst: 'Daniel',
      nameLast: 'Štorcel',
      intro:
        "Two years in Slovakia’s <b>Top 5</b> for critical thinking. A research project at the <b>Slovak Academy of Sciences</b>. A startup with a dragon on it. A mountain that isn’t climbed yet.",
      tags: ['Technology', 'AI', 'Entrepreneurship', 'Research', 'Mountains'],
      photoAlt: 'Daniel Štorcel by a canal at night',
      primaryCta: 'Download CV',
      ghostCta: 'See the record ↓',
      ticker: [
        'TOP 5 CRITICAL THINKING',
        '1ST EUROPEAN STATISTICS',
        'SAV RESEARCH',
        'JA FOODATHON INNOVATION AWARD',
        'MONT BLANC 2027',
      ],
    },
    about: {
      index: '01 / 08',
      title: 'About',
      statement:
        "I like figuring things out that aren’t on the curriculum. Some weeks that’s a Python script or a cybersecurity rabbit hole; other weeks it’s a pitch deck, a training plan, or the chemistry of a thin film under a microscope. I don’t think of these as separate lanes — together they help me grow.",
      interests: [
        { label: 'Tech & AI', tag: 'curious' },
        { label: 'Marketing & brand', tag: 'hands-on' },
        { label: 'Science & research', tag: 'SAV' },
        { label: 'Mountains', tag: 'ongoing' },
      ],
      paragraph2:
        "I’m competitive by nature and calm under pressure — I’ve worked warehouse shifts and bartended festivals, led a marketing track on an international team, and sat with lab equipment for hours getting a sample right. What connects it is the same instinct: build it, test it, see if it holds up.",
      traits: [
        'Ambitious',
        'Curious',
        'Team-oriented',
        'Resilient',
        'Competitive',
        'Self-motivated',
        'Entrepreneurial',
        'Works well under pressure',
      ],
      photoAlt: 'Daniel Štorcel in front of moored sailboats in the port of Palermo at night',
      photoCaption: 'Port of Palermo — night',
    },
    sections: {
      record: { index: '02 / 08', title: 'Track record' },
      work: { index: '03 / 08', title: "Things I’ve built" },
      research: { index: '04 / 08', title: 'Research at SAV' },
      summit: { index: '05 / 08', title: 'Mont Blanc' },
      skills: { index: '06 / 08', title: 'What I work with' },
      experience: { index: '07 / 08', title: 'Also on the résumé' },
    },
    record: {
      intro: "Competitions I’ve shown up for, across reasoning, business, and innovation.",
      items: [
        {
          stat: 'Top 5',
          title: 'Slovak Critical Thinking Competition',
          desc: 'Placed in the national Top 5 two years in a row — reasoning and analysis under time pressure.',
          bullets: [
            'Nationwide competition focused on <b>critical thinking, argumentation, media literacy</b>, working with data and exposing manipulative claims.',
            'In 2024/25, <b>11,117 students</b> entered the secondary-school round — only the <b>top 48</b> reached the national final.',
            'Finished in the <b>national Top 5 in two consecutive years</b>.',
            'Timed tests demanded fast analysis of arguments, statistics, sources and manipulation techniques.',
            'The final adds argumentation and public speaking on top of the written tests.',
          ],
          photoAlt:
            'Speaker at the podium in a grand baroque hall during the critical thinking competition ceremony, audience in the foreground',
        },
        {
          stat: '1st',
          title: 'European Statistics Competition',
          desc: '1st place in Slovakia, plus a result at European level.',
          bullets: [
            'Slovak 2025/26 edition: about <b>2,140 students</b> from <b>179 schools</b> in <b>807 teams</b>.',
            'Europe-wide: <b>28,832 students</b> from <b>22 countries</b> in <b>9,096 teams</b>.',
            'The national phase was <b>three statistics tests and a presentation of data</b>; the best teams advanced.',
            'The European round: a <b>2-minute video in English</b> that builds a "statistical portrait" of a country from official statistical data.',
            'Slovakia had <b>four teams</b> in the European final, and <b>three Slovak videos</b> made the European Top 5.',
          ],
          photoAlt: 'Waving the Slovak flag in front of a glass building at the European Statistics Competition',
        },
        {
          stat: '1st',
          title: 'JA Europe Foodathon',
          desc: 'Innovation Award, international round — marketing, finance and presentation for our team’s concept.',
          bullets: [
            'Won the <b>International Innovation Award</b> at JA Europe Foodathon.',
            'Developed a <b>student venture concept</b> in an international team, working with European and African students.',
            'My role: <b>led marketing and financial planning</b>.',
            'Produced promotional content and contributed to the <b>final pitch</b>.',
          ],
          photoAlt: 'Team Carbon Trail (JA Slovakia) on stage holding the Foodathon 2024 winners certificate',
        },
        {
          stat: '3rd',
          title: 'European Business Challenge',
          desc: '3rd in the Slovak round, 3rd overall in the European final.',
          bullets: [
            '<b>3rd place in the Slovak round</b> and <b>3rd overall in the European final</b>.',
            'Developed and presented a complete <b>business concept</b> as a team.',
            'My contribution: the <b>business model, marketing strategy, financial planning</b> and the final pitch.',
          ],
        },
      ],
    },
    work: {
      intro: 'Startup concepts, brand experiments, and ideas I keep coming back to.',
      stages: { idea: 'Idea', concept: 'Concept', prototype: 'Prototype', live: 'Live' },
      score: [
        { value: '05', label: 'projects' }, { value: '01', label: 'award' },
        { value: '01', label: 'honorable mention' }, { value: '10k', label: 'TikTok likes' },
      ],
      tileCopy: {
        aimtoruContradiction: '1 contradiction', aimtoruFacts: 'Important information',
        mountainsTags: ['Route · 6.4 km', 'Gear · −30 %', 'Hut · 2 beds'],
        taroCaption: 'Erasmus+ → expedition', grynadeLine: 'STAY LOCKED IN.',
        grynadeLikes: 'likes', carbonLabel: 'Winners · JA Europe Foodathon',
      },
      items: [
        {
          name: 'CarbonTrail',
          status: 'Award-winning',
          tile: 'carbontrail', stage: 'prototype',
          desc: "A Nutri-Score for carbon: we calculate a product's emissions and print the score on the packaging, so customers see the footprint before they buy. Built with a team in under a weekend for JA Europe Foodathon and refined with a mentor into a pitch-ready product.",
          part: '<b>My part:</b> marketing, finance, the promo video, and communicating with our African counterparts on the team.',
          skills: ['Marketing', 'Finance', 'Video', 'Pitching'],
        },
        {
          name: 'TORU',
          status: 'Honorable mention',
          tile: 'aimtoru', stage: 'prototype',
          desc: 'A clinical workspace built with my team at the Clinical AI Hackathon in Vienna (AIM Austria), where it earned an honorable mention. A clinician enters the patient and their role and task; the app pulls the task-relevant facts out of scattered medical records — every fact linked to its exact source passage, contradictions between documents flagged, and a dated timeline of the records.',
          part: '<b>My part:</b> the front-end, and the voice-over for the introduction video.',
          skills: ['Frontend', 'UX', 'Voice-over', 'Health data'],
          link: { href: 'https://aimtoru-eight.vercel.app', label: 'aimtoru-eight.vercel.app ↗' },
        },
        {
          name: 'Grynade',
          status: 'Student project',
          tile: 'grynade', stage: 'live',
          desc: 'A hardcore preworkout brand concept — neon green, black, a grenade and a dragon. "STAY LOCKED IN." Built to learn branding and social growth by doing it.',
          part: '<b>My part:</b> identity, TikTok strategy, and a "Veiny Galaxy" campaign that pulled ~10k likes.',
          skills: ['Branding', 'TikTok', 'Social growth'],
          link: { href: 'https://grynade.store', label: 'grynade.store ↗' },
        },
        {
          name: 'TARO',
          status: 'Ongoing',
          tile: 'taro', stage: 'concept',
          desc: 'A non-profit organization connecting Erasmus+, international students, and mountain expeditions — community and personal growth through adventure.',
          part: '<b>My part:</b> main founder of the concept and a distinct visual identity for its website.',
          skills: ['Concept design', 'Web identity', 'Community'],
        },
        {
          name: 'AI × Mountains',
          status: 'Idea',
          tile: 'mountains', stage: 'idea',
          desc: 'A platform idea for hikers and mountaineers — surfacing suitable routes, outdoor experiences, and discounted gear across stores using AI.',
          part: '<b>My part:</b> the original idea, unbuilt so far.',
          skills: ['AI', 'Outdoor', 'Product thinking'],
        },
      ],
    },
    research: {
      quote:
        '“Influence of deposition of atomic layers of zinc oxide on the structure of a carbon-silicon electrode” — a project carried out at the Slovak Academy of Sciences.',
      spec: [
        { label: 'Institute', value: 'CEMEA · Slovak Academy of Sciences' },
        { label: 'Method', value: 'ALD ZnO · 10 vs 20 cycles' },
        { label: 'Cross-sections', value: 'FIB · 30×20×20 → 30×1.7×2 µm' },
        { label: 'Beam current', value: '50 → 5 nA' },
        { label: 'Analysis', value: 'EDX · layer structure' },
      ],
      fib: [
        { size: '30 × 20 × 20 µm', current: '50 nA' },
        { size: '30 × 5 × 5 µm', current: '30 nA' },
        { size: '30 × 2.5 × 5 µm', current: '15 nA' },
        { size: '30 × 1.7 × 3 µm', current: '7 nA' },
        { size: '30 × 1.7 × 2 µm', current: '5 nA' },
      ],
      steps: [
        {
          title: 'Question',
          desc: 'Does an ALD-deposited ZnO layer change the structure of a silicon-graphite electrode, and how?',
        },
        {
          title: 'Experiment',
          desc: 'Prepared FIB cross-sections at varying beam currents and cut sizes, comparing samples after 10 and 20 ALD cycles.',
        },
        {
          title: 'Analysis',
          desc: 'Examined the cross-sections with EDX to read composition and layer structure.',
        },
        {
          title: 'Presented as',
          desc: 'A SOČ (student scientific research) project, written up at a research-institute level.',
        },
      ],
      linkHref: 'https://cemea.sav.sk/en/students/soc-at-cemea/',
      linkLabel: 'cemea.sav.sk/en/students/soc-at-cemea ↗',
      linkNote: 'You can also find me on the official website',
      layers: { cu: 'Cu current collector', sic: 'Si–C electrode', zno: 'ZnO (ALD)' },
      scope: {
        parts: {
          chamber: 'Vacuum chamber', eColumn: 'Electron column', iColumn: 'Ga⁺ ion column',
          tilt: '52°', detector: 'ETD detector', edx: 'EDX', stage: '5-axis stage',
          sample: 'Sample', beamE: 'e⁻ beam', beamI: 'Ga⁺ beam', trench: 'FIB trench', scale: '5 µm',
        },
        phases: [
          'Dual-beam FIB-SEM — instrument',
          'Beams on — e⁻ · Ga⁺ at 52°',
          'FIB cross-section — milling',
          'EDX — layer structure',
        ],
      },
    },
    summit: {
      sub: "Some things get measured in grades. This one gets measured in altitude — and it isn’t climbed yet. The goal is next summer.",
      peaks: [
        { name: 'Traunstein', alt: '1691 m', tag: 'Austria', coords: '47.8733° N · 13.8367° E', status: 'climbed' },
        { name: 'Gerlachovský štít', alt: '2655 m', tag: 'highest in Slovakia', coords: '49.1644° N · 20.1339° E', status: 'climbed' },
        { name: 'Mont Blanc', alt: '4808 m', tag: 'the goal — 2027', coords: '45.8326° N · 6.8652° E', status: 'the goal' },
      ],
      photoCaptions: ['Traunstein', 'Gerlachovský štít', 'Kôprovský štít', 'Velická próba'],
      photoAlts: [
        'Summit cross on Traunstein with prayer flags against a blue sky',
        'Daniel Štorcel on a rocky mountain summit',
        'Daniel Štorcel above a mountain lake',
        'Daniel Štorcel looking across a mountain ridge',
      ],
      stats: [
        { value: '1:53', label: 'Half marathon' },
        { value: '55:00', label: '10km' },
        { value: '5:10/km', label: '6km best pace' },
      ],
      prep: [
        'Running & endurance base',
        'Gym strength training',
        'Ferratas & mountain experience',
        'Mountaineering technique',
        'Equipment preparation',
        'Documenting the whole build-up',
      ],
      partners:
        'Reached out about equipment partnerships to <b>The North Face, Patagonia, La Sportiva, Exped</b> and <b>Blue Ice</b> — conversations, not confirmed deals.',
      ascentLabel: 'ASCENT',
      keepScrolling: 'Keep scrolling ↓',
      route: { label: 'Goûter route', points: ['Nid d’Aigle', 'Tête Rousse hut', 'Goûter hut', 'Dôme du Goûter', 'Vallot hut', 'Summit'] },
      hud: { peak: 'Peak', altitude: 'Altitude', climbed: 'Climbed', goal: 'The goal — summer 2027' },
      emptyFrame: { title: 'Summer 2027', note: 'Photo pending' },
      credit: 'Elevation data: Mapzen Terrain Tiles (SRTM, EU-DEM)',
    },
    skills: {
      count: '100',
      sub: '100 skills across seven fields — scroll to fly through them.',
      hud: { of: 'of', skills: 'skills', current: 'Current', hint: 'Scroll to fly through ↓', chapters: 'Chapters' },
      groups: [
        {
          id: 'tech', label: 'Technology & Programming',
          items: ['Python', 'AI Tools & Prompt Engineering', 'Artificial Intelligence Fundamentals', 'Machine Learning Fundamentals', 'Data Analysis', 'Data Visualization', 'HTML & CSS', 'Web Development', 'Git & GitHub', 'Version Control', 'VS Code', 'Software Prototyping', 'UI/UX Design', 'Frontend Development', 'Cybersecurity Fundamentals', 'IT Consulting', 'Digital Product Development', 'Workflow Automation', 'Technical Research', 'AI-Assisted Development'],
        },
        {
          id: 'science', label: 'Science & Research',
          items: ['FIB-SEM Analysis', 'Energy-Dispersive X-ray Spectroscopy (EDX)', 'Atomic Layer Deposition (ALD)', 'Materials Science', 'Nanotechnology', 'Scientific Research', 'Experimental Design', 'Scientific Data Interpretation', 'Critical Thinking', 'Statistical Analysis', 'Mathematical Modelling', 'Hypothesis Testing', 'Research Presentation', 'Analytical Problem Solving', 'Evidence-Based Reasoning'],
        },
        {
          id: 'business', label: 'Entrepreneurship & Business',
          items: ['Startup Ideation', 'Business Model Development', 'Market Research', 'Market Gap Identification', 'Business Strategy', 'Product Development', 'Innovation Management', 'Business Development', 'Financial Planning', 'Budget Management', 'Competitive Analysis', 'Customer Discovery', 'Problem Validation', 'Pitching & Presentations', 'Entrepreneurial Thinking'],
        },
        {
          id: 'marketing', label: 'Marketing & Communication',
          items: ['Digital Marketing', 'Social Media Strategy', 'TikTok Strategy', 'Content Creation', 'Brand Development', 'Personal Branding', 'Marketing Strategy', 'Promotional Campaigns', 'Visual Storytelling', 'Video Editing', 'iMovie', 'CapCut', 'Presentation Design', 'Public Speaking', 'Persuasive Communication'],
        },
        {
          id: 'soft', label: 'Leadership & Personal Skills',
          items: ['Leadership', 'International Team Collaboration', 'Cross-Cultural Communication', 'Teamwork', 'Project Management', 'Independent Learning', 'Adaptability', 'Creative Problem Solving', 'Decision Making', 'Strategic Thinking', 'Initiative & Ownership', 'Time Management', 'Resilience', 'Communication', 'Fast Learning'],
        },
        {
          id: 'outdoor', label: 'Sports & Outdoor',
          items: ['Mountaineering', 'High-Altitude Hiking', 'Via Ferrata', 'Mountain Navigation', 'Terrain Orientation', 'Endurance Running', 'Half-Marathon Running', 'Strength Training', 'Physical Endurance', 'Outdoor Risk Assessment'],
        },
        {
          id: 'analytics', label: 'Competition & Analytical Skills',
          items: ['Statistical Reasoning', 'Logical Reasoning', 'Quantitative Analysis', 'Data Interpretation', 'Competitive Problem Solving', 'Critical Decision Making', 'Pattern Recognition', 'Strategic Competition', 'Information Synthesis', 'Time-Pressured Decision Making'],
        },
      ],
    },
    experience: [
      {
        role: 'IT consultant',
        title: 'SFÉRA',
        desc: 'Consulting at SFÉRA, a Slovak IT company — working with the team on client projects, from requirements through to delivery.',
      },
      {
        role: 'Gym reception',
        title: 'FitUP!',
        desc: 'Front desk of a fitness club — member check-in, first point of contact for clients, keeping the club running on busy shifts.',
      },
      {
        role: 'Warehouse',
        title: 'Alza',
        desc: 'Picking and packing orders on the conveyor system, working independently with heavier items.',
      },
      {
        role: 'Bartending',
        title: 'Festival bar',
        desc: 'Mixing drinks and tapping beer through high-volume shifts — fast, customer-facing, team-run.',
      },
    ],
    contact: {
      index: '08 / 08',
      headline: ['You reached', 'the summit.'],
      sub: '4,808 m of scrolling. The real one is next summer.',
      signpost: { tags: { write: 'write', follow: 'follow', pdf: 'PDF', home: 'home', climbed: 'climbed' }, places: contactPoints('en'), hint: 'From the summit' },
      weather: { label: 'Mont Blanc now', wind: 'wind', codes: { clear: 'clear', partly: 'partly cloudy', cloudy: 'overcast', fog: 'fog', drizzle: 'drizzle', rain: 'rain', snow: 'snow', showers: 'showers', storm: 'thunderstorm' } },
      built: 'Built with Astro · Three.js · GSAP',
      email: 'danysto08@gmail.com',
      instagram: '@daniel._kooo',
      instagramUrl: 'https://www.instagram.com/daniel._kooo',
      copied: 'Copied',
      backToTop: 'Descend to base ↑',
      footerName: 'Daniel Štorcel — 2026',
      footerPlace: 'Bratislava, Slovakia',
    },
    langSwitch: { en: 'EN', sk: 'SK' },
  },

  sk: {
    htmlLang: 'sk',
    title: 'Daniel Štorcel',
    description:
      'Daniel Štorcel — maturant z Bratislavy. Top 5 v kritickom myslení, výskum na Slovenskej akadémii vied, študentské projekty a hora, ktorá ešte nie je zdolaná.',
    nav: { about: 'O mne', record: 'Úspechy', work: 'Projekty', research: 'Výskum', summit: 'Vrchol', skills: 'Zručnosti', experience: 'Životopis', contact: 'Kontakt' },
    cvHref: '/daniel-storcel-cv-sk.pdf',
    cvLabel: 'CV ↓',
    cvLabelPdf: 'Stiahnuť CV (PDF)',
    hero: {
      eyebrow: 'Bratislava, Slovensko — maturitný ročník',
      nameFirst: 'Daniel',
      nameLast: 'Štorcel',
      intro:
        'Dva roky v <b>Top 5</b> na Slovensku v kritickom myslení. Výskumný projekt na <b>Slovenskej akadémii vied</b>. Startup s drakom. Hora, ktorá ešte nie je zdolaná.',
      tags: ['Technológie', 'AI', 'Podnikanie', 'Výskum', 'Hory'],
      photoAlt: 'Daniel Štorcel pri kanáli v noci',
      primaryCta: 'Stiahnuť CV',
      ghostCta: 'Pozri úspechy ↓',
      ticker: [
        'TOP 5 KRITICKÉ MYSLENIE',
        '1. EURÓPSKA ŠTATISTICKÁ SÚŤAŽ',
        'VÝSKUM NA SAV',
        'CENA ZA INOVÁCIU — JA FOODATHON',
        'MONT BLANC 2027',
      ],
    },
    about: {
      index: '01 / 08',
      title: 'O mne',
      statement:
        'Rád prichádzam na veci, ktoré nie sú v osnovách. Niekedy je to Python skript alebo skúmanie kyberbezpečnosti, inokedy pitch deck, tréningový plán alebo chémia tenkej vrstvy pod mikroskopom. Nevnímam to ako oddelené oblasti — všetky spolu ma posúvajú vpred.',
      interests: [
        { label: 'Technológie a AI', tag: 'zvedavý' },
        { label: 'Marketing a značka', tag: 'v praxi' },
        { label: 'Veda a výskum', tag: 'SAV' },
        { label: 'Hory', tag: 'neustále' },
      ],
      paragraph2:
        'Som súťaživý od prírody a pod tlakom pokojný — pracoval som na zmenách v sklade, barmanil na festivaloch, viedol marketingovú časť medzinárodného tímu a hodiny som sedel pri laboratórnom vybavení, kým som nedostal správnu vzorku. Spája to rovnaký inštinkt: postaviť to, otestovať to, pozrieť sa, či to obstojí.',
      traits: [
        'Ambiciózny',
        'Zvedavý',
        'Tímový hráč',
        'Odolný',
        'Súťaživý',
        'Sebamotivovaný',
        'Podnikavý',
        'Zvláda tlak',
      ],
      photoAlt: 'Daniel Štorcel pred zakotvenými plachetnicami v prístave v Palerme v noci',
      photoCaption: 'Prístav Palermo — noc',
    },
    sections: {
      record: { index: '02 / 08', title: 'Moje úspechy' },
      work: { index: '03 / 08', title: 'Čo som vytvoril' },
      research: { index: '04 / 08', title: 'Výskum na SAV' },
      summit: { index: '05 / 08', title: 'Mont Blanc' },
      skills: { index: '06 / 08', title: 'S čím pracujem' },
      experience: { index: '07 / 08', title: 'Ďalšie z životopisu' },
    },
    record: {
      intro: 'Súťaže, do ktorých som sa zapojil — od logického myslenia cez biznis až po inovácie.',
      items: [
        {
          stat: 'Top 5',
          title: 'Slovenská súťaž v kritickom myslení',
          desc: 'Dva roky po sebe v celoštátnej Top 5 — úsudok a analýza pod časovým tlakom.',
          bullets: [
            'Celoštátna súťaž zameraná na <b>kritické myslenie, argumentáciu, mediálnu gramotnosť</b>, prácu s dátami a odhaľovanie manipulatívnych tvrdení.',
            'V ročníku 2024/25 sa do stredoškolského kola zapojilo <b>11 117 študentov</b> — do celoštátneho finále postúpilo iba <b>48 najlepších</b>.',
            'Skončil som v <b>celoštátnej Top 5 dva roky po sebe</b>.',
            'Časovo limitované testy vyžadovali rýchlu analýzu argumentov, štatistík, zdrojov a manipulačných techník.',
            'Finále popri písomných testoch pridáva aj argumentáciu a verejné vystupovanie.',
          ],
          photoAlt: 'Rečník za pódiom vo veľkej barokovej sále počas vyhlásenia súťaže v kritickom myslení, v popredí publikum',
        },
        {
          stat: '1.',
          title: 'Európska štatistická súťaž',
          desc: '1. miesto na Slovensku a výsledok aj na európskej úrovni.',
          bullets: [
            'Slovenský ročník 2025/26: približne <b>2 140 študentov</b> zo <b>179 škôl</b> v <b>807 tímoch</b>.',
            'V celej Európe: <b>28 832 študentov</b> z <b>22 krajín</b> v <b>9 096 tímoch</b>.',
            'Národná fáza pozostávala z <b>troch štatistických testov a prezentácie dát</b>; postupovali najlepšie tímy.',
            'Európske kolo: <b>2-minútové video v angličtine</b>, ktoré z oficiálnych štatistických údajov vytvára „štatistický portrét“ krajiny.',
            'Slovensko malo v európskom finále <b>štyri tímy</b> a <b>tri slovenské videá</b> sa dostali do európskej Top 5.',
          ],
          photoAlt: 'Mávanie slovenskou vlajkou pred sklenenou budovou na Európskej štatistickej súťaži',
        },
        {
          stat: '1.',
          title: 'JA Europe Foodathon',
          desc: 'Cena za inováciu, medzinárodné kolo — marketing, financie a prezentácia konceptu nášho tímu.',
          bullets: [
            'Vyhrali sme <b>Medzinárodnú cenu za inováciu</b> na JA Europe Foodathon.',
            'V medzinárodnom tíme s európskymi a africkými študentmi sme vytvorili <b>koncept študentského podniku</b>.',
            'Moja rola: <b>viedol som marketing a finančné plánovanie</b>.',
            'Vytvoril som propagačný obsah a prispel som k <b>finálnej prezentácii</b>.',
          ],
          photoAlt: 'Tím Carbon Trail (JA Slovensko) na pódiu s certifikátom víťazov Foodathon 2024',
        },
        {
          stat: '3.',
          title: 'European Business Challenge',
          desc: '3. miesto v slovenskom kole, celkovo 3. miesto v európskom finále.',
          bullets: [
            '<b>3. miesto v slovenskom kole</b> a <b>celkovo 3. miesto v európskom finále</b>.',
            'Ako tím sme vytvorili a odprezentovali kompletný <b>podnikateľský koncept</b>.',
            'Môj prínos: <b>obchodný model, marketingová stratégia, finančné plánovanie</b> a finálna prezentácia.',
          ],
        },
      ],
    },
    work: {
      intro: 'Startupové koncepty, experimenty so značkou a nápady, ku ktorým sa stále vraciam.',
      stages: { idea: 'Nápad', concept: 'Koncept', prototype: 'Prototyp', live: 'Naživo' },
      score: [
        { value: '05', label: 'projektov' }, { value: '01', label: 'ocenenie' },
        { value: '01', label: 'čestné uznanie' }, { value: '10k', label: 'lajkov na TikToku' },
      ],
      tileCopy: {
        aimtoruContradiction: '1 rozpor', aimtoruFacts: 'Dôležité informácie',
        mountainsTags: ['Trasa · 6,4 km', 'Výbava · −30 %', 'Chata · 2 lôžka'],
        taroCaption: 'Erasmus+ → expedícia', grynadeLine: 'STAY LOCKED IN.',
        grynadeLikes: 'lajkov', carbonLabel: 'Víťazi · JA Europe Foodathon',
      },
      items: [
        {
          name: 'CarbonTrail',
          status: 'Ocenený',
          tile: 'carbontrail', stage: 'prototype',
          desc: 'Nutri-Score pre uhlík: vypočítame emisie produktu a skóre vytlačíme na obal, aby zákazník videl uhlíkovú stopu ešte pred kúpou. Postavené s tímom za necelý víkend pre JA Europe Foodathon a s mentorom dotiahnuté do produktu pripraveného na pitch.',
          part: '<b>Moja časť:</b> marketing, financie, promo video a komunikácia s našimi africkými kolegami v tíme.',
          skills: ['Marketing', 'Financie', 'Video', 'Prezentovanie'],
        },
        {
          name: 'TORU',
          status: 'Čestné uznanie',
          tile: 'aimtoru', stage: 'prototype',
          desc: 'Klinické pracovné prostredie, ktoré sme s tímom postavili na Clinical AI Hackathone vo Viedni (AIM Austria), kde získalo čestné uznanie. Lekár zadá pacienta a svoju rolu a úlohu; aplikácia vytiahne z roztrúsených zdravotných záznamov fakty podstatné pre danú úlohu — každý fakt je prepojený na presnú pasáž v zdroji, rozpory medzi dokumentmi sú označené a záznamy sú zoradené na datovanej časovej osi.',
          part: '<b>Moja časť:</b> front-end a voiceover k úvodnému videu.',
          skills: ['Frontend', 'UX', 'Voiceover', 'Zdravotné dáta'],
          link: { href: 'https://aimtoru-eight.vercel.app', label: 'aimtoru-eight.vercel.app ↗' },
        },
        {
          name: 'Grynade',
          status: 'Študentský projekt',
          tile: 'grynade', stage: 'live',
          desc: 'Koncept hardcore preworkout značky — neónová zelená, čierna, granát a drak. „STAY LOCKED IN.“ Vytvorené, aby som sa naučil branding a rast na sociálnych sieťach priamo praxou.',
          part: '<b>Moja časť:</b> identita, TikTok stratégia a kampaň „Veiny Galaxy“, ktorá získala ~10 tisíc lajkov.',
          skills: ['Branding', 'TikTok', 'Rast na sociálnych sieťach'],
          link: { href: 'https://grynade.store', label: 'grynade.store ↗' },
        },
        {
          name: 'TARO',
          status: 'Prebieha',
          tile: 'taro', stage: 'concept',
          desc: 'Neziskové občianske združenie prepájajúce Erasmus+, medzinárodných študentov a horské expedície — komunita a osobný rast prostredníctvom dobrodružstva.',
          part: '<b>Moja časť:</b> hlavný zakladateľ, koncept a osobitá vizuálna identita jeho webu.',
          skills: ['Návrh konceptu', 'Webová identita', 'Komunita'],
        },
        {
          name: 'AI × Mountains',
          status: 'Nápad',
          tile: 'mountains', stage: 'idea',
          desc: 'Nápad na platformu pre turistov a horolezcov — pomocou AI vyhľadáva vhodné trasy, outdoorové zážitky a zľavnené vybavenie naprieč obchodmi.',
          part: '<b>Moja časť:</b> pôvodný nápad, zatiaľ nerealizovaný.',
          skills: ['AI', 'Outdoor', 'Produktové myslenie'],
        },
      ],
    },
    research: {
      quote:
        '„Vplyv depozície atómových vrstiev oxidu zinočnatého na štruktúru uhlíkovo-kremíkovej elektródy“ — projekt realizovaný na Slovenskej akadémii vied.',
      spec: [
        { label: 'Pracovisko', value: 'CEMEA · Slovenská akadémia vied' },
        { label: 'Metóda', value: 'ALD ZnO · 10 vs 20 cyklov' },
        { label: 'Prierezy', value: 'FIB · 30×20×20 → 30×1.7×2 µm' },
        { label: 'Prúd lúča', value: '50 → 5 nA' },
        { label: 'Analýza', value: 'EDX · štruktúra vrstiev' },
      ],
      fib: [
        { size: '30 × 20 × 20 µm', current: '50 nA' },
        { size: '30 × 5 × 5 µm', current: '30 nA' },
        { size: '30 × 2.5 × 5 µm', current: '15 nA' },
        { size: '30 × 1.7 × 3 µm', current: '7 nA' },
        { size: '30 × 1.7 × 2 µm', current: '5 nA' },
      ],
      steps: [
        {
          title: 'Otázka',
          desc: 'Mení vrstva ZnO nanesená technikou ALD štruktúru kremíkovo-grafitovej elektródy, a ako?',
        },
        {
          title: 'Experiment',
          desc: 'Pripravil som FIB prierezy pri rôznych prúdoch lúča a veľkostiach rezov a porovnával vzorky po 10 a 20 ALD cykloch.',
        },
        {
          title: 'Analýza',
          desc: 'Prierezy som skúmal pomocou EDX, aby som zistil zloženie a štruktúru vrstiev.',
        },
        {
          title: 'Spracované ako',
          desc: 'Projekt SOČ (stredoškolská odborná činnosť), spracovaný na úrovni výskumného ústavu.',
        },
      ],
      linkHref: 'https://cemea.sav.sk/studenti/soc-na-cemea/',
      linkLabel: 'cemea.sav.sk/studenti/soc-na-cemea ↗',
      linkNote: 'Viete ma nájsť aj na oficiálnej stránke',
      layers: { cu: 'Cu prúdovodič', sic: 'Si–C elektróda', zno: 'ZnO (ALD)' },
      scope: {
        parts: {
          chamber: 'Vákuová komora', eColumn: 'Elektrónový stĺpec', iColumn: 'Iónový stĺpec Ga⁺',
          tilt: '52°', detector: 'Detektor ETD', edx: 'EDX', stage: '5-osový stolík',
          sample: 'Vzorka', beamE: 'Lúč e⁻', beamI: 'Lúč Ga⁺', trench: 'FIB rez', scale: '5 µm',
        },
        phases: [
          'Dvojlúčový FIB-SEM — prístroj',
          'Lúče zapnuté — e⁻ · Ga⁺ pod 52°',
          'FIB prierez — odprašovanie',
          'EDX — štruktúra vrstiev',
        ],
      },
    },
    summit: {
      sub: 'Niektoré veci sa merajú známkami. Táto sa meria nadmorskou výškou — a ešte nie je zdolaná. Cieľ je budúce leto.',
      peaks: [
        { name: 'Traunstein', alt: '1691 m', tag: 'Rakúsko', coords: '47.8733° N · 13.8367° E', status: 'zdolaný' },
        { name: 'Gerlachovský štít', alt: '2655 m', tag: 'najvyšší na Slovensku', coords: '49.1644° N · 20.1339° E', status: 'zdolaný' },
        { name: 'Mont Blanc', alt: '4808 m', tag: 'cieľ — 2027', coords: '45.8326° N · 6.8652° E', status: 'cieľ' },
      ],
      photoCaptions: ['Traunstein', 'Gerlachovský štít', 'Kôprovský štít', 'Velická próba'],
      photoAlts: [
        'Vrcholový kríž na Traunsteine s modlitebnými vlajkami na pozadí modrej oblohy',
        'Daniel Štorcel na skalnatom horskom vrchole',
        'Daniel Štorcel nad horským plesom',
        'Daniel Štorcel s výhľadom na horský hrebeň',
      ],
      stats: [
        { value: '1:53', label: 'Polmaratón' },
        { value: '55:00', label: '10 km' },
        { value: '5:10/km', label: 'Najlepšie tempo na 6 km' },
      ],
      prep: [
        'Bežecký a vytrvalostný základ',
        'Silový tréning v posilňovni',
        'Ferraty a horské skúsenosti',
        'Horolezecká technika',
        'Príprava vybavenia',
        'Dokumentovanie celej prípravy',
      ],
      partners:
        'Oslovil som ohľadom partnerstiev na vybavenie <b>The North Face, Patagonia, La Sportiva, Exped</b> a <b>Blue Ice</b> — rozhovory, nie potvrdené dohody.',
      ascentLabel: 'VÝSTUP',
      keepScrolling: 'Scrolluj ďalej ↓',
      route: { label: 'Cesta cez Goûter', points: ['Nid d’Aigle', 'Chata Tête Rousse', 'Chata Goûter', 'Dôme du Goûter', 'Chata Vallot', 'Vrchol'] },
      hud: { peak: 'Vrchol', altitude: 'Nadmorská výška', climbed: 'Zdolaný', goal: 'Cieľ — leto 2027' },
      emptyFrame: { title: 'Leto 2027', note: 'Fotka čaká' },
      credit: 'Výškové dáta: Mapzen Terrain Tiles (SRTM, EU-DEM)',
    },
    skills: {
      count: '100',
      sub: '100 zručností zo siedmich oblastí — scrolluj a preleť cez ne.',
      hud: { of: 'z', skills: 'zručností', current: 'Aktuálna', hint: 'Scrolluj a preleť ↓', chapters: 'Kapitoly' },
      groups: [
        {
          id: 'tech', label: 'Technológie a programovanie',
          items: ['Python', 'AI nástroje a prompt engineering', 'Základy umelej inteligencie', 'Základy strojového učenia', 'Analýza dát', 'Vizualizácia dát', 'HTML a CSS', 'Vývoj webu', 'Git a GitHub', 'Správa verzií', 'VS Code', 'Softvérové prototypovanie', 'UI/UX dizajn', 'Frontend vývoj', 'Základy kybernetickej bezpečnosti', 'IT poradenstvo', 'Vývoj digitálnych produktov', 'Automatizácia procesov', 'Technický výskum', 'Vývoj s pomocou AI'],
        },
        {
          id: 'science', label: 'Veda a výskum',
          items: ['FIB-SEM analýza', 'Energiovo-disperzná röntgenová spektroskopia (EDX)', 'Depozícia atómových vrstiev (ALD)', 'Materiálová veda', 'Nanotechnológie', 'Vedecký výskum', 'Návrh experimentov', 'Interpretácia vedeckých dát', 'Kritické myslenie', 'Štatistická analýza', 'Matematické modelovanie', 'Testovanie hypotéz', 'Prezentácia výskumu', 'Analytické riešenie problémov', 'Uvažovanie založené na dôkazoch'],
        },
        {
          id: 'business', label: 'Podnikanie a biznis',
          items: ['Startupové nápady', 'Tvorba biznis modelu', 'Prieskum trhu', 'Identifikácia medzier na trhu', 'Biznis stratégia', 'Vývoj produktu', 'Manažment inovácií', 'Rozvoj biznisu', 'Finančné plánovanie', 'Správa rozpočtu', 'Analýza konkurencie', 'Spoznávanie zákazníkov', 'Validácia problému', 'Pitching a prezentácie', 'Podnikateľské myslenie'],
        },
        {
          id: 'marketing', label: 'Marketing a komunikácia',
          items: ['Digitálny marketing', 'Stratégia sociálnych sietí', 'TikTok stratégia', 'Tvorba obsahu', 'Budovanie značky', 'Osobný branding', 'Marketingová stratégia', 'Promo kampane', 'Vizuálny storytelling', 'Strih videa', 'iMovie', 'CapCut', 'Dizajn prezentácií', 'Verejné vystupovanie', 'Presvedčivá komunikácia'],
        },
        {
          id: 'soft', label: 'Líderstvo a osobné zručnosti',
          items: ['Líderstvo', 'Spolupráca v medzinárodnom tíme', 'Medzikultúrna komunikácia', 'Tímová práca', 'Projektový manažment', 'Samostatné učenie', 'Adaptabilita', 'Kreatívne riešenie problémov', 'Rozhodovanie', 'Strategické myslenie', 'Iniciatíva a zodpovednosť', 'Time management', 'Odolnosť', 'Komunikácia', 'Rýchle učenie'],
        },
        {
          id: 'outdoor', label: 'Šport a hory',
          items: ['Horolezectvo', 'Vysokohorská turistika', 'Via ferrata', 'Navigácia v horách', 'Orientácia v teréne', 'Vytrvalostný beh', 'Polmaratón', 'Silový tréning', 'Fyzická vytrvalosť', 'Posudzovanie rizík v teréne'],
        },
        {
          id: 'analytics', label: 'Súťaže a analytické zručnosti',
          items: ['Štatistické uvažovanie', 'Logické uvažovanie', 'Kvantitatívna analýza', 'Interpretácia dát', 'Riešenie úloh v súťažiach', 'Kritické rozhodovanie', 'Rozpoznávanie vzorov', 'Strategické súťaženie', 'Syntéza informácií', 'Rozhodovanie pod časovým tlakom'],
        },
      ],
    },
    experience: [
      {
        role: 'IT konzultant',
        title: 'SFÉRA',
        desc: 'Konzultácie v slovenskej IT firme SFÉRA — práca s tímom na klientskych projektoch od požiadaviek až po dodanie.',
      },
      {
        role: 'Recepcia fitka',
        title: 'FitUP!',
        desc: 'Recepcia fitness klubu — check-in členov, prvý kontakt pre klientov, chod klubu počas rušných zmien.',
      },
      {
        role: 'Sklad',
        title: 'Alza',
        desc: 'Vychystávanie a balenie objednávok na dopravníkovom systéme, samostatná práca s ťažším tovarom.',
      },
      {
        role: 'Barmanstvo',
        title: 'Festivalový bar',
        desc: 'Miešanie drinkov a čapovanie piva počas rušných zmien — rýchle tempo, kontakt so zákazníkmi, tímová práca.',
      },
    ],
    contact: {
      index: '08 / 08',
      headline: ['Dostal si sa', 'na vrchol.'],
      sub: '4 808 m scrollovania. Ten skutočný je budúce leto.',
      signpost: { tags: { write: 'napíš', follow: 'sleduj', pdf: 'PDF', home: 'domov', climbed: 'zdolaný' }, places: contactPoints('sk'), hint: 'Z vrcholu' },
      weather: { label: 'Mont Blanc teraz', wind: 'vietor', codes: { clear: 'jasno', partly: 'polooblačno', cloudy: 'zamračené', fog: 'hmla', drizzle: 'mrholenie', rain: 'dážď', snow: 'sneženie', showers: 'prehánky', storm: 'búrka' } },
      built: 'Postavené s Astro · Three.js · GSAP',
      email: 'danysto08@gmail.com',
      instagram: '@daniel._kooo',
      instagramUrl: 'https://www.instagram.com/daniel._kooo',
      copied: 'Skopírované',
      backToTop: 'Zostúp dole ↑',
      footerName: 'Daniel Štorcel — 2026',
      footerPlace: 'Bratislava, Slovensko',
    },
    langSwitch: { en: 'EN', sk: 'SK' },
  },
};
