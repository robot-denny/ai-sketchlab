/*!
* Start Bootstrap - Clean Blog v6.0.7 (https://startbootstrap.com/theme/clean-blog)
* Copyright 2013-2021 Start Bootstrap
* Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-clean-blog/blob/master/LICENSE)
*/

function labnolIframe(e) {
    var t = document.createElement("iframe");
    t.setAttribute("src", "https://www.youtube.com/embed/" + e.dataset.id + "?autoplay=1&rel=0"),
        t.setAttribute("frameborder", "0"),
        t.setAttribute("allowfullscreen", "1"),
        t.setAttribute("allow", "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"),
        e.parentNode.replaceChild(t, e)
}
function initYouTubeVideos() {
    for (var e = document.getElementsByClassName("youtube-player"), t = 0; t < e.length; t++) {
        var i = e[t].dataset.id
            , n = document.createElement("div");
        n.setAttribute("data-id", i);
        var o = document.createElement("img");
        o.src = "//i.ytimg.com/vi/ID/maxresdefault.jpg".replace("ID", i),
            o.alt = "YouTube Video Thumbnail Image",
            n.appendChild(o);
        var s = document.createElement("div");
        s.setAttribute("class", "play"),
            n.appendChild(s),
            n.onclick = function () {
                labnolIframe(this)
            }
            ,
            e[t].appendChild(n)
    }
}

window.addEventListener('DOMContentLoaded', () => {
    /* ── Section reveal on scroll ────────────────────────────── */
    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    if (revealElements.length > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const revealObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        revealElements.forEach(function(el) {
            revealObserver.observe(el);
        });
    }

    initYouTubeVideos();
})
