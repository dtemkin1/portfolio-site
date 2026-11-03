import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getImage } from "astro:assets";

import { feedMarkdown } from "../lib/feed";
import { getPublishedWork } from "../lib/work-data";

import sanitizeHtml from "sanitize-html";
import MarkdownIt from "markdown-it";
const parser = new MarkdownIt();

// A resized copy, because linking the source would publish it with its GPS metadata.
async function mediaContent(
  img: ImageMetadata,
  site: URL | undefined,
): Promise<string> {
  const { src, attributes } = await getImage({
    src: img,
    width: Math.min(img.width, 1200),
    format: "jpg",
  });
  return `<media:content
        type="image/jpeg"
        width="${attributes.width}"
        height="${attributes.height}"
        medium="image"
        url="${new URL(src, site).href}" />
    `;
}

export const GET: APIRoute = async (context) => {
  const work = await getPublishedWork();
  return rss({
    title: "Diego Temkin",
    description:
      "The personal site of Diego Temkin, an MS in Transportation student at MIT, researching how students ride transit.",
    site: context.site ?? "",
    xmlns: {
      media: "http://search.yahoo.com/mrss/",
      atom: "http://www.w3.org/2005/Atom",
    },
    customData: `<language>en-us</language><atom:link href="${context.site}rss.xml" rel="self" type="application/rss+xml" />`,
    items: await Promise.all(
      work.map(async (post) => {
        const markdown = feedMarkdown(post.data, post.body);
        return {
          title: post.data.title,
          pubDate: post.data.publishDate,
          description: post.data.description,
          link: `/work/${post.id}/`,
          content: markdown
            ? sanitizeHtml(parser.render(markdown), {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
              })
            : undefined,
          customData: post.data.img
            ? await mediaContent(post.data.img, context.site)
            : "",
        };
      }),
    ),
  });
};
