describe('create book', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000')
    cy.get('#username').type('admin')
    cy.get('#password').type('admin123')
    cy.get('button[type="submit"]').click()
  })

  it('should include authorization header in request', () => {
    cy.intercept('POST', '**/books').as('createBook')

    cy.get('.page-header > div > .btn-primary').click()
    cy.get('#c-title').type('Bela e a Fera')
    cy.get('#c-author').type('Madame de Villeneuve')
    cy.get('#c-genres').type('paperback').click()
    cy.get('form > .btn').click()

    cy.wait('@createBook').then((interception) => {
      expect(interception.request.headers['authorization']).to.include('Bearer')
    })
  })

  it('should search books by author', () => {
    cy.intercept('GET', '**/books*').as('searchBooks')

    cy.get('#s-author').type('Madame de Villeneuve')
    cy.get('.search-bar > .btn').click()

 cy.wait('@searchBooks').then((interception) => {
    expect(interception.response.statusCode).to.eq(200)
    expect(interception.response.body).to.exist
    expect(interception.response.body).to.have.length.greaterThan(0)
    })
  })
})