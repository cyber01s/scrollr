export interface Product {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  price: number;
  originalPrice: number | null;
  currency: string;
  rating: number | null;
  reviewCount: number;
  specs: string[];
  affiliateUrl: string;
  hasWhiteBg?: boolean;
  dominantColor?: string;
  aspectRatio?: number;
}

export interface RawImpactProduct {
  Id?: string;
  Name: string;
  ImageUri?: string;
  Category?: string;
  OriginalPrice?: string;
  Price?: string;
  Currency?: string;
  CampaignUri?: string;
  Rating?: string;
  ReviewCount?: string;
  Description?: string;
  [key: string]: any;
}
