const { expect } = require('chai');
const createMockServer = require('@app-core/mock-server');
const { MockModelStubs } = require('@app/mock-models');

const server = createMockServer(['endpoints/creator-cards']);
const Stubs = MockModelStubs.CreatorCard;

const REF_20 = 'crt_8f2k1m9x4p7w3q5z';
const DELETE_BODY = { creator_reference: REF_20 };

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

function deleteFindOneStub(firstDoc, secondDoc) {
  let call = 0;
  cfg({
    method: 'findOne',
    overrideFn: () => {
      call += 1;
      return call === 1 ? firstDoc : secondDoc;
    },
  });
}

function publicDeleteStubs(slug) {
  const now = Date.now();
  deleteFindOneStub(
    Stubs.createDocument({ slug, access_type: 'public', deleted: null }),
    Stubs.createDocument({ slug, access_type: 'public', deleted: now, updated: now + 1 })
  );
}

// ─── Tests ───
describe('DELETE /creator-cards/:slug', () => {
  describe('happy path', () => {
    it('soft-deletes an existing card and returns it', async () => {
      publicDeleteStubs('ada-designs-things');
      const res = await server.delete('/creator-cards/ada-designs-things', { body: DELETE_BODY });
      expect(res.statusCode).to.equal(200);
      expect(res.data.status).to.equal('success');
    });
  });

  describe('validation', () => {
    it('rejects when creator_reference is missing', async () => {
      const res = await server.delete('/creator-cards/ada-designs-things', { body: {} });
      expect(res.statusCode).to.equal(400);
      expect(res.data.status).to.equal('error');
    });

    it('rejects a creator_reference of 19 characters', async () => {
      const res = await server.delete('/creator-cards/ada-designs-things', {
        body: { creator_reference: 'crt_8f2k1m9x4p7w3q5' },
      });
      expect(res.statusCode).to.equal(400);
    });
  });

  describe('error paths', () => {
    it('returns NF01 for a non-existent slug', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.delete('/creator-cards/does-not-exist-123', { body: DELETE_BODY });
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF01');
    });

    it('returns NF01 when trying to delete an already soft-deleted card', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.delete('/creator-cards/already-deleted', { body: DELETE_BODY });
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF01');
    });
  });

  describe('response shape', () => {
    it('returns deleted as a positive integer (epoch ms)', async () => {
      const now = Date.now();
      deleteFindOneStub(
        Stubs.createDocument({
          slug: 'ada-designs-things',
          access_type: 'public',
          deleted: null,
        }),
        Stubs.createDocument({ slug: 'ada-designs-things', access_type: 'public', deleted: now })
      );
      const res = await server.delete('/creator-cards/ada-designs-things', { body: DELETE_BODY });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.deleted).to.be.a('number').and.to.be.greaterThan(0);
    });

    it('returns updated >= deleted (fresh post-update timestamp, not stale pre-update)', async () => {
      const now = Date.now();
      deleteFindOneStub(
        Stubs.createDocument({
          slug: 'ada-designs-things',
          access_type: 'public',
          updated: now - 9999,
        }),
        Stubs.createDocument({
          slug: 'ada-designs-things',
          access_type: 'public',
          deleted: now,
          updated: now + 5,
        })
      );
      const res = await server.delete('/creator-cards/ada-designs-things', { body: DELETE_BODY });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.updated).to.be.at.least(res.data.data.deleted);
    });

    it('returns id (not _id) in the response', async () => {
      publicDeleteStubs('ada-designs-things');
      const res = await server.delete('/creator-cards/ada-designs-things', { body: DELETE_BODY });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data).to.have.property('id');
      expect(res.data.data).to.not.have.property('_id');
    });

    it('returns access_code as null for a deleted public card', async () => {
      publicDeleteStubs('ada-designs-things');
      const res = await server.delete('/creator-cards/ada-designs-things', { body: DELETE_BODY });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.access_code).to.equal(null);
    });

    it('returns the access_code value for a deleted private card', async () => {
      const now = Date.now();
      deleteFindOneStub(
        Stubs.createDocument({
          slug: 'vip-rate-card',
          access_type: 'private',
          access_code: 'A1B2C3',
          deleted: null,
        }),
        Stubs.createDocument({
          slug: 'vip-rate-card',
          access_type: 'private',
          access_code: 'A1B2C3',
          deleted: now,
        })
      );
      const res = await server.delete('/creator-cards/vip-rate-card', { body: DELETE_BODY });
      expect(res.statusCode).to.equal(200);
      expect(res.data.data.access_code).to.equal('A1B2C3');
    });
  });

  describe('state consistency', () => {
    it('succeeds with any valid 20-character creator_reference value', async () => {
      publicDeleteStubs('some-card-slug');
      const res = await server.delete('/creator-cards/some-card-slug', {
        body: { creator_reference: 'zzzzzzzzzzzzzzzzzzzz' },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('returns the success message on delete', async () => {
      publicDeleteStubs('ada-designs-things');
      const res = await server.delete('/creator-cards/ada-designs-things', { body: DELETE_BODY });
      expect(res.statusCode).to.equal(200);
      expect(res.data.message).to.be.a('string').and.to.have.length.greaterThan(0);
    });

    it('simulates GET returning NF01 after the card is soft-deleted', async () => {
      cfg({ method: 'findOne', mockNull: true });
      const res = await server.get('/creator-cards/ada-designs-things');
      expect(res.statusCode).to.equal(404);
      expect(res.data.code).to.equal('NF01');
    });
  });
});
