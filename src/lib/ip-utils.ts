import ipaddr from 'ipaddr.js';
import { CloudRanges, IPPrefix } from './types';

export function parseAllPrefixes(data: CloudRanges): IPPrefix[] {
  const allPrefixes: IPPrefix[] = [];

  // AWS
  if (data.aws) {
    data.aws.prefixes.forEach(p => {
      allPrefixes.push({
        prefix: p.ip_prefix,
        region: p.region,
        service: p.service,
        provider: 'aws',
      });
    });
    data.aws.ipv6_prefixes.forEach(p => {
      allPrefixes.push({
        prefix: p.ipv6_prefix,
        region: p.region,
        service: p.service,
        provider: 'aws',
      });
    });
  }

  // GCP
  if (data.gcp) {
    data.gcp.prefixes.forEach(p => {
      if (p.ipv4Prefix) {
        allPrefixes.push({
          prefix: p.ipv4Prefix,
          region: p.scope,
          service: p.service,
          provider: 'gcp',
        });
      }
      if (p.ipv6Prefix) {
        allPrefixes.push({
          prefix: p.ipv6Prefix,
          region: p.scope,
          service: p.service,
          provider: 'gcp',
        });
      }
    });
  }

  // Oracle
  if (data.oracle) {
    data.oracle.regions.forEach(r => {
      r.cidrs.forEach(c => {
        allPrefixes.push({
          prefix: c.cidr,
          region: r.region,
          service: c.tags.join(', '),
          provider: 'oracle',
        });
      });
    });
  }

  // Cloudflare
  if (data.cloudflare) {
    data.cloudflare.result.ipv4_cidrs.forEach(c => {
      allPrefixes.push({
        prefix: c,
        service: 'Cloudflare Edge',
        provider: 'cloudflare',
      });
    });
    data.cloudflare.result.ipv6_cidrs.forEach(c => {
      allPrefixes.push({
        prefix: c,
        service: 'Cloudflare Edge',
        provider: 'cloudflare',
      });
    });
  }

  return allPrefixes;
}

export function findMatchingPrefixes(ip: string, allPrefixes: IPPrefix[]): IPPrefix[] {
  try {
    const addr = ipaddr.parse(ip);
    return allPrefixes.filter(p => {
      try {
        const [range, bits] = p.prefix.split('/');
        const cidr = ipaddr.parseCIDR(`${range}/${bits}`);
        // If versions don't match, address.match() will throw or return false
        if (addr.kind() === cidr[0].kind()) {
           return addr.match(cidr);
        }
        return false;
      } catch {
        return false;
      }
    });
  } catch (e) {
    return [];
  }
}
