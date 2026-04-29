export interface IPPrefix {
  prefix: string;
  region?: string;
  service?: string;
  provider: 'aws' | 'gcp' | 'azure' | 'oracle' | 'cloudflare';
}

export interface CloudRanges {
  aws?: {
    prefixes: Array<{ ip_prefix: string; region: string; service: string }>;
    ipv6_prefixes: Array<{ ipv6_prefix: string; region: string; service: string }>;
  };
  gcp?: {
    prefixes: Array<{ ipv4Prefix?: string; ipv6Prefix?: string; scope?: string; service?: string }>;
  };
  oracle?: {
    regions: Array<{
      region: string;
      cidrs: Array<{ cidr: string; tags: string[] }>;
    }>;
  };
  cloudflare?: {
    result: {
      ipv4_cidrs: string[];
      ipv6_cidrs: string[];
    };
  };
  updatedAt: number;
}
