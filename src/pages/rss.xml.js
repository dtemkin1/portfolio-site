import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function get(context) {
    const work = await getCollection('work');
        return rss({
            title: 'Diego Temkin',
            description: 'The personal site of Diego Temkin',
            site: context.site,
            customData: `<language>en-us</language>`,
            items: work.map((post) => ({
                title: post.data.title,
                pubDate: post.data.publishDate,
                description: post.data.description,
                // Compute RSS link from post `slug`
                // This example assumes all posts are rendered as `/blog/[slug]` routes
                link: `/work/${post.slug}/`,
        })),
    });
}