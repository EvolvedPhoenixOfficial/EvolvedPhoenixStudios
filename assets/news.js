<script>
posts.sort(byDateDesc).forEach(p => grid.appendChild(buildCard(p)));
return el('section', {class:'container', id: cat.id},
el('h2', {class:'mb-3', style:'font:800 1.4rem/1.2 system-ui'}, cat.title),
grid
);
}


function buildPage(data){
const root = document.getElementById('news-root');
if (!root) return;
root.innerHTML = '';


// Hero
const heroBtns = el('div', {class:'mt-4 flex gap-3', style:'flex-wrap:wrap'});
data.categories.forEach(c => {
heroBtns.appendChild(el('a', {class:'btn', href:'#'+c.id}, c.title));
});


const hero = el('section', {class:'page-hero'},
el('div', {class:'container'},
el('h1', {}, 'News & Devlogs'),
el('p', {}, 'Fresh updates, milestones, and behind-the-scenes notes.'),
heroBtns
)
);
root.appendChild(hero);


// Group posts by category id
const postsByCat = Object.create(null);
for (const p of (data.posts||[])){
if (!postsByCat[p.category]) postsByCat[p.category] = [];
postsByCat[p.category].push(p);
}


// Sections
for (const cat of data.categories){
const posts = postsByCat[cat.id] || [];
if (posts.length) root.appendChild(sectionForCategory(cat, posts));
}
}


async function boot(){
try{
const res = await fetch(DATA_URL, {cache:'no-store'});
if(!res.ok) throw new Error('Failed to load news.json');
const data = await res.json();


// Basic shape guard
if (!Array.isArray(data.categories) || !Array.isArray(data.posts)) {
throw new Error('news.json is missing required keys: categories[], posts[]');
}


// Sort categories by title for nav (keep your own order by listing them in that order in JSON)
// data.categories = data.categories; // respect given order


buildPage(data);
} catch (err){
console.error(err);
const root = document.getElementById('news-root');
if (root) root.innerHTML = '<div class="container"><div class="card"><div class="card-body">Unable to load news. Please check <code>/data/news.json</code>.</div></div></div>';
}
}


// Kickoff when DOM is ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
</script>