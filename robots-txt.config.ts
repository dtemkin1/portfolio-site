import type { RobotsTxtOptions } from 'astro-robots-txt';
import siteConfig from './site.config';

const robotsConfig: RobotsTxtOptions = {
	policy: [
		{
			userAgent: '*',
			// The next line enables or disables the crawling on the `robots.txt` level
			disallow: siteConfig.disableIndexing ? '/' : '',
		},
	],
	sitemapBaseFileName: 'sitemap-index', // default 'sitemap-index'
	transform(content) {
		const commentsList = [''];
		const comments = commentsList.map((item) => `# ${item}.`).join('\n');
		return `${comments}\n\n${content}`;
	},
};

export default robotsConfig;
