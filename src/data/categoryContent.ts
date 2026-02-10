/**
 * SEO Content for Category Landing Pages
 * Each category gets rich content for Google ranking
 */

export interface CategoryContent {
  id: string;
  displayName: string;
  title: string; // SEO title
  metaDescription: string;
  h1: string;
  intro: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  keywords: string[];
  relatedCategories: string[];
  popularBrands?: string[];
  priceRange?: string;
}

export const categoryContent: Record<string, CategoryContent> = {
  'guitars-bass': {
    id: 'guitars-bass',
    displayName: 'Gitarrer & Basar',
    title: 'Köp Begagnad Gitarr & Bas - Jämför Priser | Musikmarknaden',
    metaDescription: 'Hitta begagnade gitarrer och basar från Fender, Gibson, Ibanez m.fl. Jämför priser från alla marknadsplatser i Sverige. Uppdateras dagligen med nya annonser.',
    h1: 'Begagnade Gitarrer & Basar',
    intro: 'Hitta din nästa gitarr eller bas bland hundratals annonser från hela Sverige. Vi samlar begagnade elgitarrer, akustiska gitarrer och basar från Blocket, Musikbörsen, Gearloop och andra marknadsplatser. Jämför priser och hitta de bästa dealen!',
    sections: [
      {
        heading: 'Varför Köpa Begagnad Gitarr?',
        content: 'Att köpa en begagnad gitarr eller bas är ett smart val både för plånboken och miljön. Högkvalitativa gitarrer från märken som Fender, Gibson och Ibanez håller i decennier och blir ofta bättre med åren. Du kan hitta professionella instrument till en bråkdel av nypriset, och vintage-gitarrer kan till och med öka i värde över tid.',
      },
      {
        heading: 'Populära Märken',
        content: 'De mest eftertraktade märkena på begagnatmarknaden inkluderar Fender (Stratocaster, Telecaster, Jazz Bass), Gibson (Les Paul, SG), Ibanez (RG-serien, SR-basar), PRS, Music Man, och Taylor. Svenska musikern har också goda erfarenheter av Yamaha, Epiphone och Squier för budgetvänliga alternativ.',
      },
      {
        heading: 'Vad Du Ska Tänka På',
        content: 'När du köper begagnad gitarr, kontrollera halsen för räta linjer, att banden sitter kvar, och att elektroniken fungerar. Fråga alltid om instrumentets historik och om eventuella modifieringar. Möt helst upp och testa innan köp, eller be om detaljerade bilder och videos om köp på distans.',
      },
      {
        heading: 'Prisnivåer',
        content: 'Begagnade gitarrer finns i alla prisklasser. Nybörjarinstrument från Yamaha och Squier hittas från 1,000-3,000 kr. Mellanklass som Epiphone, Ibanez och MIM Fender ligger ofta mellan 3,000-8,000 kr. Professionella instrument från Gibson, amerikanska Fender och PRS kostar typiskt 8,000-30,000 kr. Vintage och collectors items kan gå för betydligt mer.',
      },
    ],
    keywords: [
      'begagnad gitarr',
      'begagnad elbas',
      'köp gitarr',
      'fender stratocaster begagnad',
      'gibson les paul',
      'akustisk gitarr begagnad',
      'ibanez',
      'precision bass',
      'jazz bass',
      'elgitarr',
    ],
    relatedCategories: ['amplifiers', 'pedals-effects', 'accessories-parts'],
    popularBrands: ['Fender', 'Gibson', 'Ibanez', 'Yamaha', 'Epiphone', 'PRS', 'Music Man', 'Taylor'],
    priceRange: '1,000 - 50,000 kr',
  },

  'drums-percussion': {
    id: 'drums-percussion',
    displayName: 'Trummor & Slagverk',
    title: 'Köp Begagnade Trummor & Cymbaler - Jämför Priser | Musikmarknaden',
    metaDescription: 'Hitta begagnade trummor, cymbaler och slagverk från Pearl, Tama, Zildjian m.fl. Jämför priser från alla marknadsplatser. Nya annonser varje dag.',
    h1: 'Begagnade Trummor & Slagverk',
    intro: 'Leta bland hundratals begagnade trumset, cymbaler och percussion-instrument från hela Sverige. Vi samlar annonser från Blocket, Musikbörsen, Gearloop och fler. Hitta Pearl, Tama, Zildjian, Sabian och andra kvalitetsmärken till bra priser.',
    sections: [
      {
        heading: 'Varför Köpa Begagnade Trummor?',
        content: 'Professionella trumset från Pearl, Tama, DW och Sonor är byggda för att hålla i generationer. Genom att köpa begagnat kan du få ett mellanklass- eller proffsset för samma pris som ett nytt nybörjarset. Cymbaler från Zildjian och Sabian förbättras ofta med ålder när de "spelar in sig". Begagnat är också ett miljövänligt val.',
      },
      {
        heading: 'Populära Märken',
        content: 'På begagnatmarknaden hittar du främst Pearl (Export, Masters), Tama (Superstar, Starclassic), Yamaha (Stage Custom, Recording Custom), DW Drums, Sonor, Ludwig och Mapex. För cymbaler dominerar Zildjian (A, K, A Custom) och Sabian (AAX, HHX), följt av Paiste och Meinl.',
      },
      {
        heading: 'Vad Du Ska Tänka På',
        content: 'Inspektera trummor noga för sprickor i trästommen och rostiga delar. Cymbaler ska vara fria från stora sprickor (mindre keyhole-cracks kan vara ok). Kontrollera att alla skruvar och fästen finns. För kompletta set, se till att virveltrumman är i gott skick då den är dyrast att ersätta. Fråga om originalskinn eller om de bytts.',
      },
      {
        heading: 'Prisnivåer',
        content: 'Begagnade nybörjarset från Yamaha, Pearl Export eller Tama Imperialstar: 3,000-7,000 kr. Mellanklass som Pearl Masters, Tama Starclassic: 8,000-15,000 kr. Proffsets från DW, high-end Tama: 15,000-40,000+ kr. Enskilda cymbaler: 500-3,000 kr beroende på storlek och kvalitet.',
      },
    ],
    keywords: [
      'begagnade trummor',
      'begagnat trumset',
      'köp trummor',
      'zildjian cymbaler',
      'sabian',
      'pearl trummor',
      'tama',
      'virveltrumma',
      'begagnade cymbaler',
    ],
    relatedCategories: ['accessories-parts', 'amplifiers'],
    popularBrands: ['Pearl', 'Tama', 'Zildjian', 'Sabian', 'DW', 'Yamaha', 'Sonor', 'Ludwig'],
    priceRange: '2,000 - 40,000 kr',
  },

  'synth-modular': {
    id: 'synth-modular',
    displayName: 'Synthesizers & Modulärt',
    title: 'Köp Begagnad Synthesizer - Analog, Digital & Modulär | Musikmarknaden',
    metaDescription: 'Hitta begagnade synthesizers från Moog, Korg, Roland m.fl. Analog synth, digital synth, modulär synth och samplers. Jämför priser från hela Sverige.',
    h1: 'Begagnade Synthesizers & Modulär Utrustning',
    intro: 'Upptäck ett stort utbud av begagnade synthesizers, från klassiska analoga till moderna digitala workstations. Vi samlar annonser på Moog, Korg, Roland, Nord och andra premium-märken från alla Sveriges marknadsplatser. Hitta din dröm-synth till rätt pris!',
    sections: [
      {
        heading: 'Varför Köpa Begagnad Synthesizer?',
        content: 'Synthesizers är en investering som ofta behåller sitt värde väl. Klassiska modeller som Moog Minimoog, Roland Juno-106 och Korg MS-20 är numera värda mer än sitt ursprungspris. Moderna synthar från Moog, Sequential och Korg håller hög kvalitet och fungerar i decennier. Köp begagnat för att få mer synth för pengarna och upptäck vintage-ljud som inte finns i nya modeller.',
      },
      {
        heading: 'Analog vs Digital',
        content: 'Analoga synthar (Moog, Sequential, Korg Minilogue) erbjuder ett varmt, organiskt ljud och ofta enklare interface. Digitala synthar (Yamaha DX7, Nord Lead, Korg Wavestate) ger större flexibilitet, polyfoni och ofta fler ljudpreset. Många producenter använder båda typerna för olika syften. Begagnatmarknaden erbjuder goda möjligheter att testa båda världarna.',
      },
      {
        heading: 'Populära Modeller',
        content: 'Efterfrågade analog synthar: Moog Subsequent 37, Korg Minilogue XD, Sequential Prophet, Roland Juno. Digital: Korg Wavestate, Roland Fantom, Nord Lead. Grooveboxes: Elektron Digitakt/Octatrack, Roland MC-707, MPC Live. Modulär: Eurorack-system från Make Noise, Mutable Instruments, Doepfer.',
      },
      {
        heading: 'Vad Du Ska Tänka På',
        content: 'Test alla tangenter och rattar. Lyssna efter onormala ljud eller brus. För vintage synthar, fråga om service-historik och om komponenter bytts. Digitala synthar: verifiera att OS är uppdaterat. Modulära system: kontrollera att alla moduler fungerar och att kablar ingår. Be om demonstration-video om du köper på distans.',
      },
    ],
    keywords: [
      'begagnad synthesizer',
      'analog synth',
      'moog',
      'korg minilogue',
      'roland juno',
      'eurorack',
      'modulär synth',
      'nord lead',
      'sequential prophet',
      'köp synthesizer',
    ],
    relatedCategories: ['studio', 'keys-pianos', 'pedals-effects'],
    popularBrands: ['Moog', 'Korg', 'Roland', 'Nord', 'Sequential', 'Arturia', 'Elektron', 'Yamaha'],
    priceRange: '3,000 - 80,000 kr',
  },

  'pedals-effects': {
    id: 'pedals-effects',
    displayName: 'Pedaler & Effekter',
    title: 'Köp Begagnade Gitarrpedaler & Effekter | Musikmarknaden',
    metaDescription: 'Hitta begagnade pedaler från Boss, Strymon, MXR, Electro-Harmonix m.fl. Overdrive, delay, reverb, fuzz och multieffekter. Jämför priser.',
    h1: 'Begagnade Gitarrpedaler & Effektenheter',
    intro: 'Bygg din pedalboard med begagnade pedaler från alla Sveriges marknadsplatser. Vi samlar annonser på Boss, Strymon, MXR, Electro-Harmonix, TC Electronic och många fler. Från klassiska overdrive-pedaler till moderna digitala multieffekter.',
    sections: [
      {
        heading: 'Varför Köpa Begagnade Pedaler?',
        content: 'Gitarrpedaler är robusta och håller i årtionden. Många pedaler från 70- och 80-talet fungerar fortfarande perfekt. Klassiker som Boss DS-1, Ibanez Tube Screamer och Electro-Harmonix Big Muff har tillverkats i miljontals exemplar och finns lättillgängligt begagnat. Boutique-pedaler från Strymon, Chase Bliss och Walrus Audio behåller ofta 70-80% av nypriset, vilket gör begagnat extra attraktivt.',
      },
      {
        heading: 'Pedaltyper',
        content: 'Overdrive/Distortion för gitarrdrag (Boss, MXR, Ibanez TS), Delay för ekon och ambient (Strymon, Boss DD-serien, MXR Carbon Copy), Reverb för rumskänsla (Strymon BigSky, EHX Holy Grail), Modulation som chorus, flanger, phaser (Boss CE-2, MXR Phase 90), och Multieffekter som kombinerar allt (Line 6 Helix, Boss GT-series, Zoom).',
      },
      {
        heading: 'Vad Du Ska Tänka På',
        content: 'Test pedalen om möjligt - kolla alla knappar, rattar och jack-uttag. Vintage pedaler kan ha slitna potentiometrar (knastrigt ljud). Kontrollera strömförsörjning - vissa kräver speciell adapter. För digitala pedaler, verifiera att senaste firmware är installerad. Fråga om originalförpackning och manualer, vilket ofta ökar andrahandsvärdet.',
      },
      {
        heading: 'Prisguide',
        content: 'Boss-pedaler (DS-1, BD-2, DD-serien): 300-1,200 kr. MXR och Electro-Harmonix: 500-1,500 kr. Boutique (Strymon, Chase Bliss, Walrus): 2,000-4,500 kr. Vintage klassiker: 1,000-5,000+ kr beroende på modell och condition. Multieffekter (Helix, Kemper, Quad Cortex): 8,000-25,000 kr.',
      },
    ],
    keywords: [
      'begagnade pedaler',
      'gitarrpedaler',
      'boss pedal',
      'strymon',
      'tube screamer',
      'delay pedal',
      'reverb pedal',
      'overdrive',
      'multieffekt',
      'pedalboard',
    ],
    relatedCategories: ['guitars-bass', 'amplifiers', 'accessories-parts'],
    popularBrands: ['Boss', 'Strymon', 'MXR', 'Electro-Harmonix', 'TC Electronic', 'Line 6', 'Ibanez'],
    priceRange: '300 - 25,000 kr',
  },

  'amplifiers': {
    id: 'amplifiers',
    displayName: 'Förstärkare',
    title: 'Köp Begagnad Gitarrförstärkare - Rör, Transistor & Modeling | Musikmarknaden',
    metaDescription: 'Hitta begagnade förstärkare från Marshall, Fender, Vox, Orange m.fl. Gitarrförstärkare och basförstärkare från hela Sverige. Jämför priser.',
    h1: 'Begagnade Gitarr- & Basförstärkare',
    intro: 'Hitta din nästa förstärkare bland hundratals annonser från hela Sverige. Vi samlar begagnade rörtoppar, combo-förstärkare och moderna modeling-amps från Marshall, Fender, Vox, Orange och många fler klassiska märken.',
    sections: [
      {
        heading: 'Rör vs Transistor vs Modeling',
        content: 'Rörförstärkare (Marshall, Fender, Vox) ger klassiskt, varmt ljud men kräver underhåll. Transistorförstärkare är robusta och lättare. Moderna modeling-amps (Kemper, Line 6 Helix, Fender Mustang) erbjuder hundratals amp-simuleringar i en enhet. Alla tre typerna finns i gott skick på begagnatmarknaden.',
      },
      {
        heading: 'Populära Märken & Modeller',
        content: 'Gitarr: Marshall JCM800/900, Fender Twin Reverb, Blues Junior, Vox AC30/AC15, Orange Rockerverb, Mesa Boogie. Bas: Ampeg SVT, Fender Bassman, Markbass, Gallien-Krueger. Modeling: Kemper Profiler, Line 6 Helix, Fender Mustang, Boss Katana.',
      },
      {
        heading: 'Vad Du Ska Tänka På',
        content: 'För rörförstärkare: fråga när rören senast byttes (kostar 500-2000kr att byta). Test alla kanaler och effektloopar. Lyssna efter brus, knastrande rattar och problem med jack-uttag. För vintage amps, originala högtalare ökar värdet. Kombos är tyngre men enklare att transportera än topp + cab.',
      },
      {
        heading: 'Effektrekommendationer',
        content: 'Mindre övningsförstärkare (5-20W): 1,000-4,000 kr. Mellanklass combo (30-50W): 3,000-10,000 kr. Proffstopp + cab: 8,000-30,000 kr. Basförstärkare head: 4,000-20,000 kr. Modeling-amps: 3,000-25,000 kr beroende på modell.',
      },
    ],
    keywords: [
      'begagnad förstärkare',
      'gitarrförstärkare',
      'marshall',
      'fender twin',
      'vox ac30',
      'rörförstärkare',
      'basförstärkare',
      'ampeg',
      'kemper',
      'combo förstärkare',
    ],
    relatedCategories: ['guitars-bass', 'pedals-effects', 'accessories-parts'],
    popularBrands: ['Marshall', 'Fender', 'Vox', 'Orange', 'Mesa Boogie', 'Ampeg', 'Markbass'],
    priceRange: '1,000 - 40,000 kr',
  },

  'studio': {
    id: 'studio',
    displayName: 'Studio-utrustning',
    title: 'Köp Begagnad Studio-utrustning - Mikrofoner, Interface, Monitorer | Musikmarknaden',
    metaDescription: 'Hitta begagnad studio-utrustning: mikrofoner (Shure, Neumann), audio interfaces (Focusrite, Universal Audio), monitorer (Genelec, KRK). Jämför priser.',
    h1: 'Begagnad Studio-utrustning',
    intro: 'Bygg din hemmastudio med begagnad utrustning från professionella märken. Vi samlar annonser på mikrofoner, audio interfaces, monitorer, preamps och annan studio-gear från hela Sverige. Spara upp till 50% jämfört med nypriser.',
    sections: [
      {
        heading: 'Vad Behöver Du?',
        content: 'En grundläggande hemmastudio består av: Audio interface (Focusrite Scarlett, Universal Audio), mikrofon (Shure SM57/58, Rode NT1), studiomonitorer (KRK, Yamaha HS-serien), hörlurar (Audio-Technica, Beyerdynamic), MIDI-keyboard och DAW-mjukvara. Allt detta finns begagnat till bra priser.',
      },
      {
        heading: 'Mikrofoner',
        content: 'Dynamiska mikrofoner (Shure SM57, SM58, SM7B) är oslagbara för sång och instrument. Kondensatormikrofoner (Rode NT1, Audio-Technica AT2020, Neumann U87) ger mer detalj men kräver phantom power. Ribbonmikrofoner (Royer, AEA) används för specifika tillämpningar. Alla typer håller i decennier.',
      },
      {
        heading: 'Audio Interfaces',
        content: 'Populära begagnade interfaces: Focusrite Scarlett (2i2, 4i4, 18i20), Universal Audio Apollo, Audient iD series, Motu, RME. Kolla antal in/utgångar baserat på ditt behov. USB-C och Thunderbolt är snabbast. Äldre USB 2.0-interfaces fungerar utmärkt för de flesta.',
      },
      {
        heading: 'Vad Du Ska Tänka På',
        content: 'Mikrofoner: testa eller be om inspelningsexempel. Kolla membranet för skador. Kondensatormikrofoner är känsligare - fråga om de förvarats torrt. Audio interfaces: verifiera drivrutiner för ditt OS. Monitorer: test för knäppningar och distorsion. Studio-gear värderas på funktion, inte utseende - småskrapor är ok.',
      },
    ],
    keywords: [
      'begagnad studioutrustning',
      'studio mikrofon',
      'audio interface',
      'focusrite scarlett',
      'shure sm57',
      'studiomonitorer',
      'genelec',
      'universal audio',
      'neumann',
      'hemstudio',
    ],
    relatedCategories: ['synth-modular', 'dj-live', 'accessories-parts'],
    popularBrands: ['Focusrite', 'Shure', 'Neumann', 'Rode', 'Genelec', 'KRK', 'Universal Audio'],
    priceRange: '500 - 50,000 kr',
  },

  'keys-pianos': {
    id: 'keys-pianos',
    displayName: 'Keyboards & Pianon',
    title: 'Köp Begagnat Piano & Keyboard - Digital, Stage, MIDI | Musikmarknaden',
    metaDescription: 'Hitta begagnade pianon, digitalpianos och keyboards från Yamaha, Roland, Nord, Kawai. Stage pianos, MIDI-controllers och mer. Jämför priser.',
    h1: 'Begagnade Keyboards & Pianon',
    intro: 'Upptäck begagnade pianon och keyboards för alla nivåer och budgetar. Vi samlar annonser på digitalpianos, stage pianos, MIDI-keyboards och klassiska pianon från Yamaha, Roland, Nord, Kawai och andra kvalitetsmärken.',
    sections: [
      {
        heading: 'Olika Typer av Keyboards',
        content: 'Digitalpiano för hemmet (Yamaha P-serien, Roland FP, Kawai): vägt klaviatur, realistiskt pianoljud. Stage piano för live (Nord Piano, Yamaha CP, Roland RD): professionella ljud, portabla. MIDI-keyboard/controller (Arturia, Native Instruments, Novation): styr mjukvarusyntar utan egna ljud. Klassiska pianon: akustiska pianinon och flyglar.',
      },
      {
        heading: 'Populära Modeller',
        content: 'Nybörjare: Yamaha P-45, Roland FP-10, Casio Privia (3,000-8,000 kr). Mellanklass: Yamaha P-125, Roland FP-30X, Kawai ES-serien (8,000-15,000 kr). Professionella: Nord Piano, Yamaha CP88, Roland RD-2000 (15,000-40,000 kr). MIDI-controllers: Arturia KeyLab, Native Instruments Komplete Kontrol (2,000-10,000 kr).',
      },
      {
        heading: 'Vad Du Ska Tänka På',
        content: 'Test alla tangenter - leta efter döda tangenter eller ojämn respons. För digital piano: kontrollera ljudet både genom högtalare och hörlurar. Vägt klaviatur viktigt för pianister. Kolla antal tangenter: 61, 76 eller 88. Verifiera att pedaler ingår. För akustiska pianon: behövs professionell stämning och transport är dyrt.',
      },
      {
        heading: 'Tillbehör',
        content: 'Många begagnade keyboards säljs utan stativ och bänk. Budgetera för keyboard-stativ (300-1,500 kr) och pianopall (500-2,000 kr). Sustain-pedal ingår ofta men kolla kvaliteten. För MIDI-keyboards behövs dator och DAW-mjukvara. Expression-pedaler och andra controllers kan köpas separat.',
      },
    ],
    keywords: [
      'begagnat piano',
      'digitalpiano',
      'stage piano',
      'yamaha p125',
      'roland fp',
      'nord piano',
      'midi keyboard',
      'begagnad keyboard',
      'kawai',
      'pianino begagnat',
    ],
    relatedCategories: ['synth-modular', 'studio', 'accessories-parts'],
    popularBrands: ['Yamaha', 'Roland', 'Nord', 'Kawai', 'Casio', 'Korg', 'Native Instruments'],
    priceRange: '2,000 - 50,000 kr',
  },

  'dj-live': {
    id: 'dj-live',
    displayName: 'DJ & Live-utrustning',
    title: 'Köp Begagnad DJ-utrustning - CDJ, Mixer, Controller | Musikmarknaden',
    metaDescription: 'Hitta begagnad DJ-utrustning: CDJs, mixers, controllers från Pioneer, Technics, Native Instruments. PA-system och scenljus. Jämför priser.',
    h1: 'Begagnad DJ & Live-utrustning',
    intro: 'Bygg din DJ-setup eller liverig med begagnad utrustning från professionella märken. Vi samlar annonser på CDJs, mixers, DJ-controllers, PA-system, ljusutrustning och mer från hela Sverige.',
    sections: [
      {
        heading: 'DJ-utrustning',
        content: 'CDJ-spelare från Pioneer (CDJ-2000, CDJ-3000) är branschstandard på klubbar. DJ-mixers: Pioneer DJM-serien, Allen & Heath Xone. DJ-controllers för digitalt DJing: Pioneer DDJ-serien, Native Instruments Traktor, Denon DJ. Vinyl-spelare: klassiska Technics SL-1200 är legendariska och håller värdet väl.',
      },
      {
        heading: 'PA & Live Sound',
        content: 'Aktiva högtalare för mindre gig (QSC, RCF, JBL EON, Yamaha DXR): 3,000-10,000 kr/par. Line array för större event. Subwoofers för bas. Mixerbord: analog (Yamaha MG, Mackie) eller digital (Behringer X32, Allen & Heath). Monitor-system för scen.',
      },
      {
        heading: 'Ljusutrustning',
        content: 'Moving heads, LED-bars, PAR-spotlights för scenljus. DMX-controllers för styrning. Rökmaskin och hazer för ljuseffekter. Begagnad scenljus från professionella produktioner finns ofta till bra priser när venues uppgraderar.',
      },
      {
        heading: 'Vad Du Ska Tänka På',
        content: 'CDJs och DJ-gear: test USB-portar och alla knappar. Pioneer-utrustning behåller värdet bäst. PA-högtalare: lyssna på distorsion vid hög volym. Kontrollera element för skador. Ljus: verifiera att alla lampor fungerar och inga DMX-problem. Transport och rigg-cases ökar värdet.',
      },
    ],
    keywords: [
      'begagnad dj utrustning',
      'cdj',
      'pioneer djm',
      'technics 1200',
      'dj controller',
      'pa system',
      'aktiva högtalare',
      'scenljus',
      'begagnad mixer',
    ],
    relatedCategories: ['studio', 'accessories-parts'],
    popularBrands: ['Pioneer', 'Technics', 'Native Instruments', 'QSC', 'RCF', 'Allen & Heath'],
    priceRange: '2,000 - 80,000 kr',
  },

  'wind-brass': {
    id: 'wind-brass',
    displayName: 'Blåsinstrument',
    title: 'Köp Begagnat Blåsinstrument - Saxofon, Trumpet, Klarinett | Musikmarknaden',
    metaDescription: 'Hitta begagnade blåsinstrument: saxofoner, trumpeter, klarinetter, flöjter från Selmer, Yamaha, Bach och fler. Jämför priser.',
    h1: 'Begagnade Blåsinstrument',
    intro: 'Hitta begagnade blåsinstrument för alla nivåer - från nybörjare till professionella musiker. Vi samlar annonser på saxofoner, trumpeter, klarinetter, flöjter och andra blåsinstrument från hela Sverige.',
    sections: [
      {
        heading: 'Populära Blåsinstrument',
        content: 'Saxofoner: Alt-sax (nybörjarvänligt), tenor-sax (jazz/pop), sopran och baryton. Märken: Selmer, Yamaha, Yanagisawa. Trumpeter: Bb-trumpet vanligast, C-trumpet för orkester. Märken: Bach, Yamaha, Getzen. Klarinetter: Bb-klarinett standard, A-klarinett för orkester. Märken: Buffet, Yamaha, Selmer. Flöjter: Silverflöjter för bättre ljud.',
      },
      {
        heading: 'Nybörjare vs Professionell',
        content: 'Nybörjarinstrument (Yamaha Student-serie, Jupiter): bra kvalitet, prisvärda (3,000-10,000 kr). Mellanklass (Yamaha Custom, Selmer): betydligt bättre spelbarhet och ljud (10,000-25,000 kr). Professionella (Selmer Serie II/III, Bach Stradivarius): används av proffs världen över (25,000-80,000+ kr).',
      },
      {
        heading: 'Vad Du Ska Tänka På',
        content: 'Spela eller låt en erfaren musiker testa instrumentet. Kontrollera alla klaffar - de ska röra sig smidigt utan att fastna. Leta efter bucklor, särskilt på saxofoner. Fråga när instrumentet senast servicats (rengöring, nya korkar, justering). Service kan kosta 1,000-3,000 kr. Munstycke ofta personligt - räkna med att köpa nytt.',
      },
      {
        heading: 'Service & Underhåll',
        content: 'Blåsinstrument behöver regelbunden service för att fungera optimalt. Saxofoner och klarinetter: byt korkar vart 1-3 år. Trumpeter: olja ventiler regelbundet. Professionell genomgång rekommenderas varje 1-2 år. Räkna in servicekostnad när du budgeterar begagnatköp.',
      },
    ],
    keywords: [
      'begagnad saxofon',
      'begagnad trumpet',
      'begagnad klarinett',
      'selmer',
      'yamaha blåsinstrument',
      'altsax',
      'tenorsax',
      'blåsinstrument',
    ],
    relatedCategories: ['accessories-parts', 'strings-other'],
    popularBrands: ['Selmer', 'Yamaha', 'Bach', 'Buffet', 'Yanagisawa'],
    priceRange: '3,000 - 80,000 kr',
  },

  'strings-other': {
    id: 'strings-other',
    displayName: 'Stränginstrument & Övrigt',
    title: 'Köp Begagnat Stränginstrument - Violin, Cello, Ukulele | Musikmarknaden',
    metaDescription: 'Hitta begagnade stränginstrument: violiner, cellor, ukuleles, mandoliner, dragspel och mer. Klassiska och folkliga instrument. Jämför priser.',
    h1: 'Begagnade Stränginstrument & Andra Instrument',
    intro: 'Utforska begagnade stränginstrument och andra specialinstrument. Vi samlar annonser på violiner, cellor, ukuleles, mandoliner, dragspel och mycket mer från hela Sverige.',
    sections: [
      {
        heading: 'Stränginstrument',
        content: 'Violiner och violor för klassisk musik och folk. Storlekar från 1/8 för barn till full-size för vuxna. Cello och kontrabas för orkester och ensemble. Ukulele: sopranukulele vanligast, koncert- och tenorukulele för större ljud. Mandolin för bluegrass och folk. Banjo för amerikansk folkmusik.',
      },
      {
        heading: 'Dragspel & Munspel',
        content: 'Pianodragspel (knappharmonika) populärt i folkmusik. Märken som Hohner och Scandalli. Dragspel kräver regelbunden service för att stämmorna ska fungera. Munspel: diatoniska för blues/folk (Hohner Marine Band), kromatiska för jazz. Melodica som alternativ.',
      },
      {
        heading: 'Exotiska & Folkliga Instrument',
        content: 'Irländsk bouzouki, grekisk bouzouki, sitar från Indien, oud från Mellanöstern. Dessa instrument finns sporadiskt på begagnatmarknaden men kan ge unika ljud. Kräver ofta speciell kunskap för inköp och underhåll.',
      },
      {
        heading: 'Vad Du Ska Tänka På',
        content: 'Violiner/cellor: kontrollera sprickor i träet (kan vara dyrt att laga). Stråke ingår sällan - budgetera 500-3,000 kr för bra stråke. Nya strängar behövs ofta (200-1,000 kr). Ukulele: kontrollera stämning och att greppbrädan är rak. Dragspel: test alla tangenter/knappar och balgen för läckor. Professionell besiktning rekommenderas för dyrare instrument.',
      },
    ],
    keywords: [
      'begagnad violin',
      'begagnad cello',
      'ukulele',
      'begagnat dragspel',
      'mandolin',
      'banjo',
      'stränginstrument',
      'munspel',
    ],
    relatedCategories: ['wind-brass', 'guitars-bass', 'accessories-parts'],
    popularBrands: ['Yamaha', 'Stentor', 'Hohner', 'Fender (ukulele)', 'Kala'],
    priceRange: '500 - 50,000 kr',
  },

  'accessories-parts': {
    id: 'accessories-parts',
    displayName: 'Tillbehör & Delar',
    title: 'Köp Begagnat Musiktillbehör - Kablar, Cases, Stativ | Musikmarknaden',
    metaDescription: 'Hitta begagnade musiktillbehör: gitarrkablar, instrument-cases, mikrofonstativer, pedalboards, pickups och reservdelar. Jämför priser.',
    h1: 'Begagnade Tillbehör & Reservdelar',
    intro: 'Hitta alla tillbehör och reservdelar du behöver för dina instrument. Vi samlar annonser på kablar, cases, stativ, pickups, pedaler och mycket mer från hela Sverige. Spara pengar på kvalitetstillbehör.',
    sections: [
      {
        heading: 'Kablar & Kontakter',
        content: 'Instrumentkablar (jack till jack) för gitarr/bas: Planet Waves, Fender, Monster Cable. XLR-kablar för mikrofoner. Patch-kablar för pedalboards. Speakerkablar för förstärkare. Begagnade kablar från kvalitetsmärken fungerar ofta perfekt i decennier. Kolla att kontakterna inte är lösa.',
      },
      {
        heading: 'Cases & Gigbags',
        content: 'Hardcase för flygtransport och maxskydd. Gigbags för enkel transport. Flight cases för professionell touring. Populära märken: Gator, SKB, Mono, Hiscox. Begagnade cases har ofta skrapmärken men skyddar instrumentet lika bra. Kontrollera låsen och handtagen.',
      },
      {
        heading: 'Stativ & Hållare',
        content: 'Gitarrstativ: vägg-monterade eller fristående. Mikrofonstativer: galgar för overhead, raka för sång. Keyboardstativ: X-stativ eller Z-stativ. Notställ. Cymbalställ, hi-hat-ställ för trummor. Begagnade stativ är ofta prisvärda och funktionella.',
      },
      {
        heading: 'Pickups & Elektronik',
        content: 'Gitarrpickups: Humbucker (Gibson-sound), Single-coil (Fender-sound), P90. Populära märken: Seymour Duncan, DiMarzio, EMG, Bare Knuckle. Byte av pickups kan transformera en budget-gitarr. Begagnade pickups från kvalitetsmärken behåller 60-80% av värdet. Lödning krävs för installation.',
      },
    ],
    keywords: [
      'gitarrkablar',
      'instrument case',
      'gigbag',
      'mikrofonstativ',
      'pickups',
      'seymour duncan',
      'pedalboard',
      'gitarrstativ',
      'xlr kabel',
    ],
    relatedCategories: ['guitars-bass', 'studio', 'pedals-effects'],
    popularBrands: ['Planet Waves', "D'Addario", 'Seymour Duncan', 'Gator', 'Mono'],
    priceRange: '100 - 5,000 kr',
  },
};

/**
 * Get all category IDs
 */
export const getAllCategoryIds = (): string[] => {
  return Object.keys(categoryContent);
};

/**
 * Get content for a specific category
 */
export const getCategoryContent = (categoryId: string): CategoryContent | null => {
  return categoryContent[categoryId] || null;
};
