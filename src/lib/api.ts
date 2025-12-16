const API_BASE = "https://api.parse.bot/scraper/0f1f1694-68f5-4a07-8498-3b2e8a026a74";

export interface Ad {
  ad_id: string;
  title: string;
  price: string;
  location: string;
}

export interface AdDetails extends Ad {
  description: string;
  images: string[];
  contact_info: {
    email?: string;
    phone?: string;
  };
}

export interface AdsResponse {
  ads: Ad[];
  page: number;
  per_page: number;
  total_ads: number;
}

export async function fetchAdListings(category?: string, page: number = 1): Promise<AdsResponse> {
  const response = await fetch(`${API_BASE}/fetch_ad_listings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ category, page }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch ad listings");
  }

  return response.json();
}

export async function getAdDetails(ad_id: string): Promise<AdDetails> {
  const response = await fetch(`${API_BASE}/get_ad_details`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ad_id }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch ad details");
  }

  return response.json();
}
