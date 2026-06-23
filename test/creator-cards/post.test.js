const { expect } = require('chai');
const createMockServer = require('@app-core/mock-server');
const { MockModelStubs } = require('@app/mock-models');

const server = createMockServer(['endpoints/creator-cards']);
const Stubs = MockModelStubs.CreatorCard;

const REF_20 = 'crt_8f2k1m9x4p7w3q5z';

const BASE = {
  title: 'My Creator Card',
  creator_reference: REF_20,
  status: 'published',
};

let activeStubs = [];

function cfg(options) {
  const stub = Stubs.configureStubs(options);
  activeStubs.push(stub);
  return stub;
}

afterEach(() => {
  activeStubs.forEach((s) => s.revert());
  activeStubs = [];
});

// ─── Tests ───
describe('POST /creator-cards', () => {
  describe('required fields', () => {
    it('rejects when title is missing', async () => {
      const { title, ...payload } = BASE;
      const res = await server.post('/creator-cards', { body: payload });
      expect(res.statusCode).to.equal(400);
      expect(res.data.status).to.equal('error');
    });

    it('rejects when creator_reference is missing', async () => {
      // eslint-disable-next-line camelcase
      const { creator_reference, ...payload } = BASE;
      const res = await server.post('/creator-cards', { body: payload });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects when status is missing', async () => {
      const { status, ...payload } = BASE;
      const res = await server.post('/creator-cards', { body: payload });
      expect(res.statusCode).to.equal(400);
    });

    it('accepts a minimal valid payload', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', { body: BASE });
      expect(res.statusCode).to.equal(200);
      expect(res.data.status).to.equal('success');
    });
  });

  describe('title validation', () => {
    it('rejects a title of 2 characters', async () => {
      const res = await server.post('/creator-cards', { body: { ...BASE, title: 'ab' } });
      expect(res.statusCode).to.equal(400);
    });

    it('accepts a title of exactly 3 characters (min boundary)', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', { body: { ...BASE, title: 'abc' } });
      expect(res.statusCode).to.equal(200);
    });

    it('accepts a title of exactly 100 characters (max boundary)', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, title: 'a'.repeat(100) },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('rejects a title of 101 characters', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, title: 'a'.repeat(101) },
      });
      expect(res.statusCode).to.equal(400);
    });
  });

  describe('description validation', () => {
    it('accepts a description of exactly 500 characters (max boundary)', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, description: 'a'.repeat(500) },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('rejects a description of 501 characters', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, description: 'a'.repeat(501) },
      });
      expect(res.statusCode).to.equal(400);
    });
  });

  describe('slug — client provided', () => {
    it('rejects a slug of 4 characters', async () => {
      const res = await server.post('/creator-cards', { body: { ...BASE, slug: 'abcd' } });
      expect(res.statusCode).to.equal(400);
    });

    it('accepts a slug of exactly 5 characters (min boundary)', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', { body: { ...BASE, slug: 'abcde' } });
      expect(res.statusCode).to.equal(200);
    });

    it('accepts a slug of exactly 50 characters (max boundary)', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, slug: 'a'.repeat(50) },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('rejects a slug of 51 characters', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, slug: 'a'.repeat(51) },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('returns SL02 when a provided slug is already taken', async () => {
      // default findOne returns a document — slug appears taken
      const res = await server.post('/creator-cards', {
        body: { ...BASE, slug: 'george-cooks' },
      });
      expect(res.statusCode).to.equal(400);
      expect(res.data.code).to.equal('SL02');
    });
  });

  describe('slug — auto-generation', () => {
    it('generates "ada-designs-things" from "Ada Designs Things"', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, title: 'Ada Designs Things' },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.slug).to.equal('ada-designs-things');
    });

    it('lowercases an all-caps title when generating a slug', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, title: 'HELLO WORLD' },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.slug).to.equal('hello-world');
    });

    it('strips special characters from the title when generating a slug', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, title: 'Caf! @Mast#r' },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.slug).to.match(/^[a-z0-9\-_]+$/);
    });

    it('appends a suffix when the auto-generated slug is already taken', async () => {
      let call = 0;
      cfg({
        method: 'findOne',
        overrideFn: (queryData) => {
          call += 1;
          // first call: slug taken; second call: suffix not taken
          return call === 1 ? Stubs.createDocument(queryData.query) : null;
        },
      });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, title: 'Ada Designs Things' },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.slug).to.not.equal('ada-designs-things');
    });

    it('appends a suffix when the auto-generated slug is shorter than 5 characters', async () => {
      cfg({ method: 'findOne', mockNull: true });
      // 'Hi!' → buildSlugFromTitle → 'hi' (2 chars, < 5) → suffix appended
      const res = await server.post('/creator-cards', { body: { ...BASE, title: 'Hi!' } });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.slug.length).to.be.greaterThan(4);
    });
  });

  describe('creator_reference validation', () => {
    it('rejects a creator_reference of 19 characters', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, creator_reference: 'crt_8f2k1m9x4p7w3q5' },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('accepts a creator_reference of exactly 20 characters', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', { body: BASE });
      expect(res.statusCode).to.equal(200);
    });

    it('rejects a creator_reference of 21 characters', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, creator_reference: 'crt_8f2k1m9x4p7w3q5za1' },
      });
      expect(res.statusCode).to.equal(400);
    });
  });

  describe('links validation', () => {
    it('rejects links that is not an array', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, links: { title: 'YouTube', url: 'https://youtube.com' } },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects a link with a missing title', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, links: [{ url: 'https://youtube.com' }] },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects a link with a title longer than 100 characters', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, links: [{ title: 'a'.repeat(101), url: 'https://youtube.com' }] },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects a link with a missing url', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, links: [{ title: 'YouTube' }] },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects a link url longer than 200 characters', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, links: [{ title: 'YouTube', url: `https://${'a'.repeat(195)}` }] },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects a link url that does not start with http:// or https://', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, links: [{ title: 'FTP Link', url: 'ftp://example.com' }] },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('accepts a single valid link', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, links: [{ title: 'YouTube', url: 'https://youtube.com' }] },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('accepts multiple valid links', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: {
          ...BASE,
          links: [
            { title: 'YouTube', url: 'https://youtube.com' },
            { title: 'Instagram', url: 'https://instagram.com' },
          ],
        },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('stores and returns links array in the response', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const links = [{ title: 'YouTube', url: 'https://youtube.com/@me' }];
      const res = await server.post('/creator-cards', { body: { ...BASE, links } });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.links).to.deep.equal(links);
    });
  });

  describe('service_rates validation', () => {
    it('rejects service_rates that is an array instead of an object', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, service_rates: [{ currency: 'NGN', rates: [] }] },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects an invalid currency', async () => {
      const res = await server.post('/creator-cards', {
        body: {
          ...BASE,
          service_rates: { currency: 'EUR', rates: [{ name: 'Post', amount: 100 }] },
        },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects an empty rates array', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, service_rates: { currency: 'NGN', rates: [] } },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects a rate name of 2 characters', async () => {
      const res = await server.post('/creator-cards', {
        body: {
          ...BASE,
          service_rates: { currency: 'NGN', rates: [{ name: 'ab', amount: 100 }] },
        },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('accepts a rate name of exactly 3 characters (min boundary)', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: {
          ...BASE,
          service_rates: { currency: 'NGN', rates: [{ name: 'abc', amount: 100 }] },
        },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('rejects a rate description longer than 250 characters', async () => {
      const res = await server.post('/creator-cards', {
        body: {
          ...BASE,
          service_rates: {
            currency: 'NGN',
            rates: [{ name: 'Post', amount: 100, description: 'a'.repeat(251) }],
          },
        },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects a rate amount of 0', async () => {
      const res = await server.post('/creator-cards', {
        body: {
          ...BASE,
          service_rates: { currency: 'NGN', rates: [{ name: 'Post', amount: 0 }] },
        },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects a non-integer rate amount (1.5)', async () => {
      const res = await server.post('/creator-cards', {
        body: {
          ...BASE,
          service_rates: { currency: 'NGN', rates: [{ name: 'Post', amount: 1.5 }] },
        },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('accepts a rate amount of exactly 1 (minimum valid)', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: {
          ...BASE,
          service_rates: { currency: 'NGN', rates: [{ name: 'Post', amount: 1 }] },
        },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('stores and returns service_rates object in the response', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const serviceRates = {
        currency: 'NGN',
        rates: [{ name: 'IG Story Post', amount: 5000000, description: 'One story mention' }],
      };
      const res = await server.post('/creator-cards', {
        body: { ...BASE, service_rates: serviceRates },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.service_rates).to.deep.equal(serviceRates);
    });
  });

  describe('access_type and access_code', () => {
    it('returns AC01 when access_type is private and access_code is absent', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, access_type: 'private' },
      });
      expect(res.statusCode).to.equal(400);
      expect(res.data.code).to.equal('AC01');
    });

    it('accepts a private card with a valid 6-character alphanumeric access_code', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, access_type: 'private', access_code: 'A1B2C3' },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('accepts an explicit public card with no access_code', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, access_type: 'public' },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('returns AC05 when access_type is public and access_code is provided', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, access_type: 'public', access_code: 'A1B2C3' },
      });
      expect(res.statusCode).to.equal(400);
      expect(res.data.code).to.equal('AC05');
    });

    it('returns AC05 when access_type is omitted but access_code is provided', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, access_code: 'A1B2C3' },
      });
      expect(res.statusCode).to.equal(400);
      expect(res.data.code).to.equal('AC05');
    });

    it('rejects an access_code of 5 characters (VSL requires exactly 6)', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, access_type: 'private', access_code: 'ABCDE' },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects an access_code of 7 characters (VSL requires exactly 6)', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, access_type: 'private', access_code: 'ABCDEFG' },
      });
      expect(res.statusCode).to.equal(400);
    });

    it('rejects an access_code containing a non-alphanumeric character', async () => {
      const res = await server.post('/creator-cards', {
        body: { ...BASE, access_type: 'private', access_code: 'AB!2C3' },
      });
      expect(res.statusCode).to.equal(400);
    });
  });

  describe('status validation', () => {
    it('rejects status "archived" (not in the draft|published enum)', async () => {
      const res = await server.post('/creator-cards', { body: { ...BASE, status: 'archived' } });
      expect(res.statusCode).to.equal(400);
    });

    it('accepts status "draft"', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', { body: { ...BASE, status: 'draft' } });
      expect(res.statusCode).to.equal(200);
    });
  });

  describe('response shape', () => {
    it('returns id (not _id) in the response', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', { body: BASE });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data).to.have.property('id');
      expect(res.data.data).to.not.have.property('_id');
    });

    it('does not include __v in the response', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', { body: BASE });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data).to.not.have.property('__v');
    });

    it('returns access_code as null for public cards', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, access_type: 'public' },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.access_code).to.equal(null);
    });

    it('echoes access_code back in the response for private cards', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', {
        body: { ...BASE, access_type: 'private', access_code: 'A1B2C3' },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.access_code).to.equal('A1B2C3');
    });

    it('returns deleted as null on a freshly created card', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', { body: BASE });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.deleted).to.equal(null);
    });

    it('returns created and updated as numbers', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.post('/creator-cards', { body: BASE });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.created).to.be.a('number');
      expect(res.data.data.updated).to.be.a('number');
    });
  });
});
