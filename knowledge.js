/* knowledge.js — everything kobe.ai knows about Kobe.
   EDIT THIS FILE to update what the assistant says. It is used by:
     • the website (offline answers when the AI backend isn't reachable)
     • the Cloudflare Worker (it becomes the AI's system prompt)
   Keep the part after "window.KOBE_KB =" valid JSON: double quotes, no trailing commas, no comments. */
window.KOBE_KB = {
  "profile": {
    "name": "Kobe Orteza",
    "headline": "AI Engineering student building intelligent software, machine learning systems, and AI-integrated hardware.",
    "location": "Manila, Philippines",
    "education": "BS Artificial Intelligence Engineering at Mapúa University",
    "focus": ["AI systems", "Machine learning", "Neural networks", "Computer vision", "AI-integrated hardware", "Embedded systems", "Robotics"],
    "mindset": "Builder mindset: prototype, test, iterate. Cross-disciplinary: code + circuits + AI. A bias toward learning by building.",
    "availability": "Open to internships and junior developer opportunities in 2026, plus collaborations and interesting technical problems.",
    "interests": ["Exploring emerging AI tools, ideas, and applications", "Joining AI-related seminars, talks, and learning opportunities", "Solo travel and exploring new places", "Art: poster-making, murals, and cartooning"]
  },
  "projects": [
    {
      "name": "Hiraya",
      "type": "AI application",
      "summary": "A demo AI-powered study assistant app that helps students organize their material and get answers through a conversational assistant.",
      "tech": ["AI", "Flutter", "Firebase"],
      "keywords": ["hiraya", "study", "student", "assistant", "flutter", "chatbot", "app"]
    },
    {
      "name": "Kalsada",
      "type": "AI + civic tech",
      "summary": "A demo AI traffic intelligence application that analyzes transportation data to model congestion and support smarter urban mobility decisions.",
      "tech": ["AI", "Django", "Firebase"],
      "keywords": ["kalsada", "traffic", "congestion", "mobility", "transport", "django", "civic", "road"]
    },
    {
      "name": "ES9038Q2M DAC",
      "type": "Embedded audio hardware (current hardware project)",
      "summary": "A high-fidelity audio hardware build around the ES9038Q2M DAC chip, covering firmware, digital audio, and I²C/SPI integration from the chip to the output stage. It explores embedded programming, electronics, and software-to-hardware integration.",
      "tech": ["C", "C++", "I²C", "SPI", "Digital audio"],
      "keywords": ["dac", "es9038", "es9038q2m", "audio", "hi-fi", "hifi", "i2c", "spi", "firmware", "embedded"]
    },
    {
      "name": "Rice mixer & dryer",
      "type": "Robotics + sensing concept",
      "summary": "An autonomous, solar-powered robotics concept to help Filipino farmers: it mixes grain under the sun automatically and uses humidity sensing to detect incoming rain.",
      "tech": ["Embedded", "Sensors", "Robotics", "Solar"],
      "keywords": ["rice", "grain", "dryer", "mixer", "farmer", "farm", "solar", "humidity", "rain", "agriculture"]
    },
    {
      "name": "Smart campus energy saving system",
      "type": "Computer vision + ML",
      "summary": "An AI-driven energy optimization system using scikit-learn and OpenCV to read visual and environmental data and make smarter energy decisions on campus.",
      "tech": ["Scikit-learn", "OpenCV", "Computer vision", "Machine learning"],
      "keywords": ["campus", "energy", "opencv", "scikit", "vision", "electricity", "saving", "optimization"]
    },
    {
      "name": "Ethical AI framework",
      "type": "Responsible AI capstone concept",
      "summary": "A capstone concept for catching dataset and model bias through automated tests, evaluation workflows, and visualizations.",
      "tech": ["AI", "Bias detection", "ML evaluation"],
      "keywords": ["ethical", "ethics", "bias", "fairness", "responsible", "capstone", "evaluation"]
    },
    {
      "name": "Smart medicine pillbox",
      "type": "Connected hardware / IoT",
      "summary": "A prototype that reminds patients to take their medication on time through an automated, connected system. It was featured by Explained PH.",
      "tech": ["IoT", "Automation", "Healthcare"],
      "keywords": ["pill", "pillbox", "medicine", "medication", "iot", "health", "healthcare", "explained ph", "reminder"]
    },
    {
      "name": "Hydro turbine",
      "type": "Renewable energy research",
      "summary": "Research into micro-hydro turbines as a way to generate renewable energy from wastewater flows.",
      "tech": ["Research", "Energy", "Engineering"],
      "keywords": ["hydro", "turbine", "wastewater", "water", "renewable", "energy research"]
    },
    {
      "name": "Sumo bot",
      "type": "Autonomous competition robot",
      "summary": "An autonomous sumo robot designed, built, and programmed for school robotics competitions. It won the Sumo Bot championship at Camalaniugan NHS.",
      "tech": ["Robotics", "Control", "Autonomy", "Sensors"],
      "keywords": ["sumo", "bot", "robot", "competition", "autonomous"]
    }
  ],
  "skills": {
    "Languages": ["C", "C++", "Java", "Python", "JavaScript"],
    "Development": ["Flutter", "Django", "Firebase", "REST APIs"],
    "Cloud & web": ["Cloudflare", "Vercel", "Firebase"],
    "Tools": ["VS Code", "Arduino IDE", "Tinkercad", "Git / GitHub", "Figma"],
    "Hardware": ["Arduino", "Raspberry Pi", "ESP32", "Ultrasonic sensors", "Laser sensors", "Embedded C/C++", "I²C", "SPI", "Digital audio"],
    "AI / ML": ["Scikit-learn", "OpenCV", "Machine learning", "Image processing", "Image recognition", "Computer vision", "Neural networks", "Model evaluation"]
  },
  "achievements": {
    "engineering": [
      "Robotica ng Masa (2019): Regional 4th runner-up",
      "School-based robotics competitions: Sumo Bot champion at Camalaniugan NHS, and other school-level titles",
      "DICT Division Robotics Competition: Champion, laser & ultrasonic sensor category",
      "UP National STEM Expo: Bronze medalist for robotics innovation",
      "Smart medicine pillbox: featured by Explained PH"
    ],
    "creative": [
      "Poster-making awardee, 2015–2024",
      "Mural contest winner, University of Saint Louis Tuguegarao",
      "Commissioned station mural for XFM Radio Tuguegarao",
      "Cartoonist since 2018, with multiple congressional and division-level awards",
      "Scrap-making contest winner in senior high",
      "Jungle dish gardening contest champion"
    ]
  },
  "contact": {
    "how": "Use the Contact section at the bottom of the site (email, GitHub, LinkedIn, CV).",
    "best_for": "Internships, junior developer roles, collaborations, and interesting technical problems."
  },
  "offline_answers": [
    { "keywords": ["hello", "hi", "hey", "sup", "yo"], "answer": "Hey! I'm kobe.ai, Kobe's portfolio assistant. Ask me about his projects, skills, achievements, or whether he's open to opportunities." },
    { "keywords": ["who", "about", "yourself", "introduce", "kobe"], "answer": "Kobe Orteza is an AI Engineering student at Mapúa University in Manila. He builds intelligent software, machine learning systems, and AI-integrated hardware, and his approach is prototype → test → iterate." },
    { "keywords": ["intern", "internship", "hire", "hiring", "job", "available", "open", "opportunity", "work with"], "answer": "Yes. Kobe is open to internships and junior developer opportunities in 2026, as well as collaborations. The Contact section at the bottom of the page is the best way to reach him." },
    { "keywords": ["school", "study", "studying", "university", "college", "education", "mapua", "mapúa", "degree", "course"], "answer": "Kobe is studying for a BS in Artificial Intelligence Engineering at Mapúa University, focusing on AI systems, ML, neural networks, computer vision, and AI hardware." },
    { "keywords": ["skill", "skills", "stack", "language", "languages", "tech", "tools", "know"], "answer": "Languages: C, C++, Java, Python, JavaScript. Dev: Flutter, Django, Firebase, REST APIs. Cloud: Cloudflare, Vercel. Hardware: Arduino, Raspberry Pi, ESP32, sensors, Embedded C/C++, I²C, SPI. AI/ML: scikit-learn, OpenCV, computer vision, neural networks, model evaluation." },
    { "keywords": ["award", "awards", "won", "win", "achievement", "achievements", "competition", "medal", "champion"], "answer": "Highlights: DICT Division Robotics champion (laser & ultrasonic category), Bronze at the UP National STEM Expo, Robotica ng Masa regional 4th runner-up, Sumo Bot champion at Camalaniugan NHS, and his pillbox was featured by Explained PH. He also has many art awards, including murals, posters, and cartooning." },
    { "keywords": ["hardware", "electronics", "embedded", "circuit", "arduino", "esp32"], "answer": "On the hardware side Kobe has built a high-fidelity ES9038Q2M DAC (firmware plus I²C/SPI), a connected smart medicine pillbox, an autonomous sumo bot, and a solar rice mixer & dryer concept. He works with Arduino, Raspberry Pi, and ESP32." },
    { "keywords": ["project", "projects", "built", "build", "portfolio", "work"], "answer": "Kobe's projects: Hiraya (AI study assistant), Kalsada (AI traffic intelligence), an ES9038Q2M DAC, a solar rice mixer & dryer, a smart campus energy system using computer vision, an ethical AI bias-detection framework, a smart medicine pillbox, hydro turbine research, and an autonomous sumo bot. Ask me about any of them!" },
    { "keywords": ["art", "draw", "mural", "poster", "cartoon", "creative"], "answer": "Kobe is also an artist: a poster-making awardee from 2015 to 2024, a mural contest winner at the University of Saint Louis Tuguegarao, painter of a commissioned mural for XFM Radio Tuguegarao, and an award-winning cartoonist since 2018." },
    { "keywords": ["hobby", "hobbies", "free time", "fun", "travel", "interest", "interests"], "answer": "Outside of building things, Kobe goes to AI seminars and talks, explores new AI tools, and travels solo to new places." },
    { "keywords": ["where", "location", "based", "live", "from", "philippines", "manila"], "answer": "Kobe is based in Manila, Philippines." },
    { "keywords": ["contact", "email", "reach", "linkedin", "github", "cv", "resume"], "answer": "You can reach Kobe through the Contact section at the bottom of this page: email, GitHub, LinkedIn, and his CV are all there." },
    { "keywords": ["this site", "website", "hologram", "how did", "made this", "portfolio built"], "answer": "Kobe built this portfolio with plain HTML, CSS, and JavaScript. The hologram is his photo turned into thousands of 1s and 0s on a canvas, and the AI cursor builds each section as you scroll. I'm powered by Claude through a Cloudflare Worker." }
  ]
};
