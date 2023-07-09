import Swup from "swup";
// import SwupA11yPlugin from "@swup/a11y-plugin";
import SwupHeadPlugin from "@swup/head-plugin";
import SwupSlideTheme from "@swup/slide-theme";
import SwupPreloadPlugin from "@swup/preload-plugin";
import SwupProgressPlugin from "@swup/progress-plugin";
import SwupScrollPlugin from "@swup/scroll-plugin";

const swup = new Swup({
    plugins: [
        // new SwupA11yPlugin(),
        new SwupHeadPlugin({ 
            awaitAssets: true, 
        }),
        new SwupSlideTheme(),
        new SwupPreloadPlugin(),
        new SwupProgressPlugin(),
        new SwupScrollPlugin()
    ]
});

swup.on('contentReplaced', function () {
    const navitems = document.getElementsByClassName("nav-items");
    const menucontent = document.getElementById("menu-content") as HTMLDivElement;
    const menubutton = document.getElementsByClassName("menu-button")[0] as HTMLButtonElement;
    const pathname = window.location.pathname;

    if (menucontent !== null) {
        menucontent.hidden = true;
    }

    menubutton.ariaExpanded = "false";

    for (const child of navitems[0].children) {
        const childa = child.children[0] as HTMLAnchorElement;
        const chiidPathname = childa.pathname;

        if (pathname === chiidPathname) {
            childa.ariaCurrent = "true";
        } else {
            childa.removeAttribute("aria-current");
        }

        if (pathname === chiidPathname || (chiidPathname !== '/' && pathname.startsWith(chiidPathname))) {
            childa.classList.add("active");
        } else {
            childa.classList.remove("active");
        }

    }
})