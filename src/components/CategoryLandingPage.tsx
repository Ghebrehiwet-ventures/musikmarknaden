import { SEOHead } from './SEOHead';
import { getCategoryContent, CategoryContent } from '@/data/categoryContent';
import { generateCategoryMetaTags, generateBreadcrumbSchema } from '@/lib/seo';

interface CategoryLandingPageProps {
  categoryId: string;
  children?: React.ReactNode; // Listings/filters will be passed as children
}

/**
 * Category Landing Page with SEO Content
 * 
 * Usage:
 * <CategoryLandingPage categoryId="guitars-bass">
 *   <AdListings category="guitars-bass" />
 * </CategoryLandingPage>
 */
export function CategoryLandingPage({ categoryId, children }: CategoryLandingPageProps) {
  const content = getCategoryContent(categoryId);
  
  if (!content) {
    return <div>Kategori inte hittad</div>;
  }

  const seo = generateCategoryMetaTags(categoryId);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Hem', url: '/' },
    { name: content.displayName, url: `/category/${categoryId}` },
  ]);

  return (
    <>
      <SEOHead {...seo} schema={breadcrumbSchema} />
      
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section with SEO Content */}
        <section className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            {/* Breadcrumbs */}
            <nav className="text-sm mb-4">
              <ol className="flex items-center space-x-2 text-gray-500">
                <li><a href="/" className="hover:text-gray-700">Hem</a></li>
                <li>/</li>
                <li className="text-gray-900">{content.displayName}</li>
              </ol>
            </nav>

            {/* H1 Heading */}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {content.h1}
            </h1>

            {/* Intro Paragraph */}
            <p className="text-lg text-gray-600 mb-6">
              {content.intro}
            </p>

            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4 text-sm">
              {content.popularBrands && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Populära märken:</span>
                  <span className="text-gray-600">
                    {content.popularBrands.slice(0, 4).join(', ')}
                  </span>
                </div>
              )}
              {content.priceRange && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Prisintervall:</span>
                  <span className="text-gray-600">{content.priceRange}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Main Content - Listings */}
        <section className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </section>

        {/* SEO Content Sections (Below Listings) */}
        <section className="bg-white border-t mt-12">
          <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="prose prose-lg max-w-none">
              {content.sections.map((section, index) => (
                <div key={index} className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    {section.heading}
                  </h2>
                  <p className="text-gray-700 leading-relaxed">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Related Categories */}
            {content.relatedCategories && content.relatedCategories.length > 0 && (
              <div className="mt-12 pt-8 border-t">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Relaterade Kategorier
                </h3>
                <div className="flex flex-wrap gap-3">
                  {content.relatedCategories.map((relatedId) => {
                    const related = getCategoryContent(relatedId);
                    if (!related) return null;
                    return (
                      <a
                        key={relatedId}
                        href={`/category/${relatedId}`}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 hover:text-gray-900 transition-colors"
                      >
                        {related.displayName}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Keywords (Hidden, for SEO) */}
            <div className="hidden">
              {content.keywords.join(', ')}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
