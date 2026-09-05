import {readFile,writeFile} from 'node:fs/promises';
const previous=await readFile('index.html','utf8');
const paperStart=previous.indexOf('      <div class="research-papers">');
const paperEnd=previous.indexOf('    </section>',paperStart);
if(paperStart<0||paperEnd<0)throw new Error('Existing publications block not found');
const papers=previous.slice(paperStart,paperEnd).replace('A look at LawEducator: a conversational system that combines','LawEducator combines').replace('Read the journal paper','Paper').replace('Read the paper on IEEE Xplore','Paper on IEEE Xplore').replace('Read the research overview','Overview');
const index=`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Jerry Guo — mathematics research, software and hardware projects, and AMC, AIME, and USA(J)MO solutions on AoPS.">
  <meta name="theme-color" content="#f8faff">
  <title>Jerry Guo</title>
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="index.css">
  <script type="module" src="site.js"></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" id="home">
    <a class="wordmark" href="#about" aria-label="Jerry Guo, home"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 26 16 5 28 26 16 20Z"/></svg>Jerry Guo</a>
    <nav aria-label="Main navigation"><a href="#about">About</a><a href="#projects">Projects</a><a href="#papers">Research</a><a href="#aops">AoPS</a></nav>
  </header>
  <main id="main">
    <section class="intro section-wrap" id="about" aria-labelledby="intro-title">
      <div class="intro-copy">
        <h1 id="intro-title">Jerry Guo</h1>
        <p>I work on mathematics research and software and hardware projects. Online, I go by <a href="https://github.com/ConcaveTriangle">ConcaveTriangle</a>.</p>
        <p>My background includes competition mathematics and coursework at Foothill College in Math 1A–1D and CS 2A.</p>
        <div class="profile-links"><a href="https://github.com/ConcaveTriangle">GitHub</a><a href="https://www.linkedin.com/in/jerry-guo-66a211229/">LinkedIn</a><a href="mailto:jerryxguo2006@gmail.com">Email</a></div>
      </div>
      <img class="portrait" src="profile.jpeg" alt="Jerry Guo" width="180" height="210">
    </section>
    <section class="section-wrap content-section" id="projects" aria-labelledby="projects-title">
      <div class="section-heading"><h2 id="projects-title">Projects</h2><a class="text-link" href="https://github.com/ConcaveTriangle?tab=repositories">GitHub ↗</a></div>
      <div class="project-grid">
        <article class="project-card"><h3><a href="projects/helmet-hud.html">Helmet HUD <span aria-hidden="true">↗</span></a></h3><p>A Raspberry Pi heads-up display with live sensors, navigation, weather, and destinations sent from a phone.</p><span class="project-meta">Hardware · Python · In progress</span></article>
        <article class="project-card"><h3><a href="projects/eliza.html">Eliza v2 <span aria-hidden="true">↗</span></a></h3><p>A personal AI agent with persistent conversations, resumable analysis, tools, and memory.</p><span class="project-meta">AI · In progress</span></article>
        <article class="project-card"><h3><a href="projects/selfportrait.html">SelfPortrait v2 <span aria-hidden="true">↗</span></a></h3><p>A language-model project exploring personal conversational style. I'm working on the second version.</p><span class="project-meta">Language models · In progress</span></article>
        <article class="project-card"><h3><a href="projects/aegis.html">Aegis <span aria-hidden="true">↗</span></a></h3><p>A local-first Reddit feed and comment filter, with configurable preferences and optional semantic classification.</p><span class="project-meta">Browser tools · In progress</span></article>
        <article class="project-card"><h3><a href="projects/spike-countdown.html">VALORANT spike countdown <span aria-hidden="true">↗</span></a></h3><p>A Windows countdown overlay with visual HUD detection and manual hotkeys.</p><span class="project-meta">Python · <a href="https://github.com/ConcaveTriangle/Valorant-Spike-Countdown">Source code ↗</a></span></article>
      </div>
    </section>
    <section class="section-wrap content-section research-section" id="papers" aria-labelledby="research-title">
      <div class="section-heading"><h2 id="research-title">Research</h2></div>
      <p class="research-intro">I'm currently working on Chromatic graph coloring research.</p>
${papers}    </section>
    <section class="section-wrap content-section aops-section" id="aops" aria-labelledby="aops-title">
      <h2 id="aops-title">Math solutions</h2>
      <p>I write solutions to AMC, AIME, and USA(J)MO problems on <a href="https://artofproblemsolving.com/community">Art of Problem Solving (AoPS)</a>.</p>
    </section>
  </main>
  <footer class="site-footer section-wrap" id="contact"><p>© <span data-year>2026</span> Jerry Guo</p><a href="mailto:jerryxguo2006@gmail.com">jerryxguo2006@gmail.com</a><a href="#home">Back to top ↑</a></footer>
</body>
</html>
`;
await writeFile('index.html',index);
const script=await readFile('site.js','utf8');
await writeFile('site.js',script.slice(script.indexOf("document.querySelectorAll('[data-year]')"),script.indexOf("const svg=document.querySelector('#geometry');")).trim()+'\n');
for(const path of ['projects/helmet-hud.html','projects/eliza.html','projects/selfportrait.html','projects/aegis.html','projects/spike-countdown.html','research/laweducator.html']){
  let page=await readFile(path,'utf8');
  page=page.replace(/<nav aria-label="Main navigation">[\s\S]*?<\/nav>/,`<nav aria-label="Main navigation"><a href="../index.html#about">About</a><a href="../index.html#projects"${path.startsWith('projects/')?' aria-current="page"':''}>Projects</a><a href="../index.html#papers"${path.startsWith('research/')?' aria-current="page"':''}>Research</a><a href="../index.html#aops">AoPS</a></nav>`)
    .replace('Say hello','Email').replace(/<span class="blue-dot">\.<\/span>/g,'')
    .replace(/<figure class="article-diagram">[\s\S]*?<\/figure>/g,'')
    .replace(/<p class="eyebrow">[\s\S]*?<\/p>/,'')
    .replace('A personal agent built around continuous conversation, tools, and memory that survives beyond a single session.','A personal AI agent with persistent conversations, tools, and memory.')
    .replace('An ongoing exploration of personal conversational style, with a second version in progress.','A language-model project exploring personal conversational style. Version 2 is in progress.')
    .replace('Explore the earlier Eliza ↗','Earlier version on GitHub ↗')
    .replace('Explore the earlier version ↗','Earlier version on GitHub ↗')
    .replace('Ask me about Helmet HUD ↗','Contact ↗').replace('Ask me about Aegis ↗','Contact ↗')
    .replace('Ask about v2 ↗','Contact ↗').replace('Get in touch ↗','Email ↗')
    .replace('Beyond a single conversation','Overview').replace('The question behind the project','Overview')
    .replace('Information at a glance','Overview').replace('The interesting engineering problem','Data freshness')
    .replace('A system that can be explored in pieces','Components').replace('Making a feed more intentional','Overview')
    .replace('A focused tool','Overview').replace('Keeping it small','Implementation')
    .replace('Current work and the longer view','Status').replace('Making work durable','Persistent sessions');
  await writeFile(path,page);
}
console.log('Simplified homepage and all project pages; publication metadata preserved.');
