import products from '../../data/products.json';

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder';
  attributes: Record<string, string>;
  image: string;
  product_url: string;
}

const productData = products as Product[];

export const searchProducts = (query: string): Product[] => {
  const q = query.toLowerCase();
  return productData.filter((p) => {
    const haystack = `${p.title} ${p.description} ${Object.values(p.attributes).join(' ')}`.toLowerCase();
    return haystack.includes(q) || q.includes('product') || q.includes('show more');
  });
};

export const getProductsPage = (
  query: string,
  offset: number,
  limit: number,
  excludedIds: string[] = [],
): Product[] => {
  const result = searchProducts(query).filter((p) => !excludedIds.includes(p.id));
  return result.slice(offset, offset + limit);
};
