/* =============================================
   LouageConnect — Theme Toggle (Dark / Light)
   ============================================= */
(function () {
    var STORAGE_KEY = 'louageconnect.theme';

    function getSavedTheme() {
        try {
            var v = localStorage.getItem(STORAGE_KEY);
            if (v === 'light' || v === 'dark') return v;
        } catch (e) {}
        return null;
    }

    function getPreferredTheme() {
        var saved = getSavedTheme();
        if (saved) return saved;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    }

    function applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        // Update any rendered toggle's aria-label
        var toggles = document.querySelectorAll('.theme-toggle');
        for (var i = 0; i < toggles.length; i++) {
            toggles[i].setAttribute(
                'aria-label',
                theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
            );
            toggles[i].setAttribute(
                'title',
                theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
            );
        }
    }

    function setTheme(theme) {
        try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
        applyTheme(theme);
    }

    function toggleTheme() {
        var current = document.documentElement.getAttribute('data-theme') === 'light'
            ? 'light' : 'dark';
        setTheme(current === 'light' ? 'dark' : 'light');
    }

    // Apply immediately to prevent flash (script is loaded in <head>)
    applyTheme(getPreferredTheme());

    // SVG icons
    var ICON_HTML =
        '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' +
        '</svg>' +
        '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<circle cx="12" cy="12" r="4"/>' +
            '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>' +
        '</svg>';

    function buildButton(extraClass) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'theme-toggle' + (extraClass ? ' ' + extraClass : '');
        btn.innerHTML = ICON_HTML;
        btn.addEventListener('click', toggleTheme);
        return btn;
    }

    function injectButton() {
        // Avoid double-injection
        if (document.querySelector('.theme-toggle')) return;

        var navActions = document.querySelector('.nav-actions');
        if (navActions) {
            var btn = buildButton();
            // Insert at the start of nav-actions, before user/login buttons
            navActions.insertBefore(btn, navActions.firstChild);
        } else {
            // No navbar — use floating top-right toggle (auth pages, etc.)
            var floating = buildButton('theme-toggle-floating');
            document.body.appendChild(floating);
        }

        applyTheme(getPreferredTheme()); // refresh aria-label on freshly inserted buttons
    }

    function safeInject() {
        if (!document.body) {
            // Body not ready yet — try again
            setTimeout(safeInject, 30);
            return;
        }
        injectButton();
        // Fallback: if for any reason no toggle ended up in the DOM, force floating
        setTimeout(function () {
            if (!document.querySelector('.theme-toggle')) {
                var f = buildButton('theme-toggle-floating');
                document.body.appendChild(f);
                applyTheme(getPreferredTheme());
            }
        }, 200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', safeInject);
    } else {
        safeInject();
    }

    // React to OS theme changes only if user hasn't set a preference yet
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-color-scheme: light)');
        var mqHandler = function (e) {
            if (!getSavedTheme()) applyTheme(e.matches ? 'light' : 'dark');
        };
        if (mq.addEventListener) mq.addEventListener('change', mqHandler);
        else if (mq.addListener) mq.addListener(mqHandler);
    }

    // Expose for manual access if needed
    window.LouageTheme = { set: setTheme, toggle: toggleTheme, get: getPreferredTheme };
})();
