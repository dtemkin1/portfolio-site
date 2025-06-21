import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

import sanitizeHtml from "sanitize-html";
import MarkdownIt from "markdown-it";
const parser = new MarkdownIt();

export const GET: APIRoute = async (context) => {
  const work = await getCollection("work");
  return rss({
    title: "Diego Temkin",
    description: "The personal site of Diego Temkin",
    site: context.site ?? "",
    xmlns: {
      media: "http://search.yahoo.com/mrss/",
      atom: "http://www.w3.org/2005/Atom",
    },
    customData: `<language>en-us</language><atom:link href="${context.site}rss.xml" rel="self" type="application/rss+xml" />`,
    items: work.map((post) => ({
      title: post.data.title,
      pubDate: post.data.publishDate,
      description: post.data.description,
      // Compute RSS link from post `slug`
      // This example assumes all posts are rendered as `/blog/[slug]` routes
      link: `/work/${post.id}/`,
      content: sanitizeHtml(parser.render(post.body ?? "")),
      customData: `<media:content
        type="image/${post.data.img.format == "jpg" ? "jpeg" : "png"}"
        width="${post.data.img.width}"
        height="${post.data.img.height}"
        medium="image"
        url="${context.site + post.data.img.src}" />
    `,
    })),
  });
}
