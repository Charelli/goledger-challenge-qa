describe('user profile', () => {
  let token

  before(() => {
    cy.visit('http://localhost:3000')
    cy.get('#username').type('admin')
    cy.get('#password').type('admin123')
    cy.get('button[type="submit"]').click()

    cy.request('POST', 'http://localhost:8080/auth/login', {
      username: 'admin',
      password: 'admin123'
    }).then((res) => {
      token = res.body.token
    })
  })

  it('should not return password in response', () => {
    cy.request({
      method: 'GET',
      url: 'http://localhost:8080/me',
      headers: {
        Authorization: `Bearer ${token}`
      }
    }).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.not.have.property('password')
    })
  })
})