import type { MetadataRoute } from 'next'
 
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://jee-os.vercel.app'
  
  const routes = [
    '', '/tutor', '/coach', '/tests', '/mocks', '/syllabus', '/log', 
    '/planner', '/revisions', '/flashcards', '/formulas', '/resources', 
    '/analytics', '/peers', '/profile', '/settings', '/advanced'
  ]

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }))
}
