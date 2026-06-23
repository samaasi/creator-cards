const { expect } = require('chai');
const createMockServer = require('@app-core/mock-server');
const { MockModelStubs } = require('@app/mock-models');

const server = createMockServer(['endpoints/creator-cards']);
const Stubs = MockModelStubs.CreatorCard;

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
describe('GET /creator-cards/:slug', () => {
  describe('happy paths', () => {
    it('returns a public published card', async () => {
      cfg({
        method: 'findOne',
        docConfig: { status: 'published', access_type: 'public', deleted: null },
      });
      const res = await server.get('/creator-cards/george-cooks');
      expect(res.statusCode).to.equal(200);
      expect(res.data.status).to.equal('success');
    });

    it('returns a private card when the correct access_code is provided', async () => {
      cfg({
        method: 'findOne',
        docConfig: {
          status: 'published',
          access_type: 'private',
          access_code: 'A1B2C3',
          deleted: null,
        },
      });
      const res = await server.get('/creator-cards/vip-rate-card', {
        query: { access_code: 'A1B2C3' },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.status).to.equal('success');
    });
  });

  describe('error paths', () => {
    it('returns NF01 for a non-existent slug', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.get('/creator-cards/does-not-exist-123');
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF01');
    });

    it('returns NF02 for a draft card', async () => {
      cfg({
        method: 'findOne',
        docConfig: { status: 'draft', access_type: 'public', deleted: null },
      });
      const res = await server.get('/creator-cards/my-draft-card');
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF02');
    });

    it('returns AC03 when a private card is accessed without an access_code', async () => {
      cfg({
        method: 'findOne',
        docConfig: {
          status: 'published',
          access_type: 'private',
          access_code: 'A1B2C3',
          deleted: null,
        },
      });
      const res = await server.get('/creator-cards/vip-rate-card');
      expect(res.statusCode).to.equal(403);
      expect(res.data.code).to.equal('AC03');
    });

    it('returns AC04 when a private card is accessed with the wrong access_code', async () => {
      cfg({
        method: 'findOne',
        docConfig: {
          status: 'published',
          access_type: 'private',
          access_code: 'A1B2C3',
          deleted: null,
        },
      });
      const res = await server.get('/creator-cards/vip-rate-card', {
        query: { access_code: 'WRONG1' },
      });
      expect(res.statusCode).to.equal(403);
      expect(res.data.code).to.equal('AC04');
    });

    it('returns NF01 (not NF02) for a soft-deleted card', async () => {
      // deleted card has deleted≠null, so findOne({deleted:null}) returns nothing
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.get('/creator-cards/ada-designs-things');
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF01');
    });
  });

  describe('access rule ordering', () => {
    it('returns NF01 even when access_code query param is present on a non-existent slug', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.get('/creator-cards/does-not-exist', {
        query: { access_code: 'A1B2C3' },
      });
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF01');
    });

    it('returns NF02 (not AC03) when a card is both draft and private', async () => {
      cfg({
        method: 'findOne',
        docConfig: {
          status: 'draft',
          access_type: 'private',
          access_code: 'A1B2C3',
          deleted: null,
        },
      });
      const res = await server.get('/creator-cards/draft-private-card');
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF02');
    });

    it('returns AC03 (not AC04) when no access_code is provided for a private card', async () => {
      cfg({
        method: 'findOne',
        docConfig: {
          status: 'published',
          access_type: 'private',
          access_code: 'A1B2C3',
          deleted: null,
        },
      });
      // no access_code query param
      const res = await server.get('/creator-cards/vip-rate-card');
      expect(res.statusCode).to.equal(403);
      expect(res.data.code).to.equal('AC03');
    });
  });

  describe('response shape', () => {
    it('does not include access_code in the response for a public card', async () => {
      cfg({
        method: 'findOne',
        docConfig: { status: 'published', access_type: 'public', deleted: null },
      });
      const res = await server.get('/creator-cards/george-cooks');
      expect(res.statusCode).to.equal(200);
      expect(res.data.data).to.not.have.property('access_code');
    });

    it('does not include access_code in the response even for a private card with the correct pin', async () => {
      cfg({
        method: 'findOne',
        docConfig: {
          status: 'published',
          access_type: 'private',
          access_code: 'A1B2C3',
          deleted: null,
        },
      });
      const res = await server.get('/creator-cards/vip-rate-card', {
        query: { access_code: 'A1B2C3' },
      });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data).to.not.have.property('access_code');
    });

    it('returns id (not _id) in the response', async () => {
      cfg({
        method: 'findOne',
        docConfig: { status: 'published', access_type: 'public', deleted: null },
      });
      const res = await server.get('/creator-cards/george-cooks');
      expect(res.statusCode).to.equal(200);
      expect(res.data.data).to.have.property('id');
      expect(res.data.data).to.not.have.property('_id');
    });

    it('does not include __v in the response', async () => {
      cfg({
        method: 'findOne',
        docConfig: { status: 'published', access_type: 'public', deleted: null },
      });
      const res = await server.get('/creator-cards/george-cooks');
      expect(res.statusCode).to.equal(200);
      expect(res.data.data).to.not.have.property('__v');
    });
  });
});
