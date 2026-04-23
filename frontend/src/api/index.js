import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 30000 })

api.interceptors.response.use(r => r, err => {
    const msg = err.response?.data?.error || err.message || 'Request failed'
    return Promise.reject(new Error(msg))
})

// Companies
export const companiesApi = {
    getAll: (params) => api.get('/companies', { params }),
    getOne: (id) => api.get(`/companies/${id}`),
    create: (data) => api.post('/companies', data),
    update: (id, data) => api.put(`/companies/${id}`, data),
    delete: (id) => api.delete(`/companies/${id}`),
    bulkDelete: (ids) => api.post('/companies/bulk-delete', { ids }),
    bulkStatus: (ids, status) => api.post('/companies/bulk-status', { ids, status }),
    addContact: (id, data) => api.post(`/companies/${id}/contacts`, data),
    deleteContact: (contactId) => api.delete(`/companies/contacts/${contactId}`),
    importExcel: (file) => {
        const fd = new FormData(); fd.append('file', file)
        return api.post('/companies/import-excel', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    exportExcel: () => window.open('/api/companies/export-excel', '_blank'),
    downloadTemplate: () => window.open('/api/companies/template-excel', '_blank'),
    getStats: () => api.get('/companies/stats/summary'),
}

// Campaigns
export const campaignsApi = {
    getAll: () => api.get('/campaigns'),
    getOne: (id) => api.get(`/campaigns/${id}`),
    create: (data) => api.post('/campaigns', data),
    update: (id, data) => api.put(`/campaigns/${id}`, data),
    delete: (id) => api.delete(`/campaigns/${id}`),
    sendTest: (id, testEmail) => api.post(`/campaigns/${id}/send-test`, { test_email: testEmail }),
    sendSelected: (id, companyIds) => api.post(`/campaigns/${id}/send-selected`, { company_ids: companyIds }),
    sendAll: (id) => api.post(`/campaigns/${id}/send-all`),
}

// Scraper
export const scraperApi = {
    run: (urls) => api.post('/scraper/run', { urls }),
    importUrls: (file) => {
        const fd = new FormData(); fd.append('file', file)
        return api.post('/scraper/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    getSession: (id) => api.get(`/scraper/session/${id}`),
}

// Email Logs
export const logsApi = {
    getAll: (params) => api.get('/logs', { params }),
    getStats: () => api.get('/logs/stats'),
    retry: (id) => api.post(`/logs/${id}/retry`),
    delete: (id) => api.delete(`/logs/${id}`),
    exportExcel: () => window.open('/api/logs/export', '_blank'),
}

// Settings
export const settingsApi = {
    get: () => api.get('/settings'),
    update: (data) => api.put('/settings', data),
    getGmailStatus: () => api.get('/settings/gmail/status'),
    getAuthUrl: () => api.get('/settings/gmail/auth-url'),
    disconnect: () => api.post('/settings/gmail/disconnect'),
    uploadCredentials: (file) => {
        const fd = new FormData(); fd.append('credentials', file)
        return api.post('/settings/gmail/credentials', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    getTemplate: () => api.get('/settings/template'),
    saveTemplate: (content) => api.put('/settings/template', { content }),
}

// Resume Parser
export const resumeApi = {
    parse: (file, position) => {
        const fd = new FormData()
        fd.append('resume', file)
        if (position) fd.append('position', position)
        return api.post('/resume/parse', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90000 })
    },
    generateTemplate: (info, position) => api.post('/resume/generate-template', { info, position }),
}

export default api
