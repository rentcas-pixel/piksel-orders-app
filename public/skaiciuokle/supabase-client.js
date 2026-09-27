(function () {
  "use strict";

  const config = window.PIKSEL_SUPABASE_CONFIG || {};
  const baseUrl = String(config.url || "").replace(/\/$/, "");
  const publishableKey = String(config.publishableKey || "");

  function assertConfigured() {
    if (!baseUrl || !publishableKey) {
      throw new Error("Supabase konfigūracija neužpildyta");
    }
  }

  async function request(path, options) {
    assertConfigured();
    const settings = options || {};
    const headers = Object.assign(
      {
        apikey: publishableKey,
        Authorization: `Bearer ${settings.accessToken || publishableKey}`,
        Accept: "application/json",
      },
      settings.headers || {}
    );

    if (settings.body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`${baseUrl}${path}`, {
      method: settings.method || "GET",
      headers,
      body: settings.body === undefined ? undefined : JSON.stringify(settings.body),
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const message = payload && payload.message ? payload.message : `Supabase klaida (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function rest(table, query, options) {
    const suffix = query ? `?${query}` : "";
    return request(`/rest/v1/${table}${suffix}`, options);
  }

  function rpc(functionName, body, options) {
    return request(`/rest/v1/rpc/${functionName}`, Object.assign({}, options, {
      method: "POST",
      body: body || {},
    }));
  }

  window.PikselSupabase = Object.freeze({
    configured: Boolean(baseUrl && publishableKey),
    request,
    rest,
    rpc,
    health: () => request("/auth/v1/settings"),
    screens: Object.freeze({
      list: (accessToken) => rest("screens", "select=*&is_active=eq.true&order=name.asc", { accessToken }),
    }),
    campaigns: Object.freeze({
      list: (accessToken) => rest("campaigns", "select=*&order=created_at.desc", { accessToken }),
      create: (campaign, screens, accessToken) =>
        rpc("create_campaign_managed", { p_campaign: campaign, p_screens: screens }, { accessToken }),
      getByToken: (publicToken, accessToken) =>
        rpc("get_campaign_by_token", { p_public_token: publicToken }, { accessToken }),
      updateByToken: (publicToken, campaign, screens, accessToken) =>
        rpc("update_campaign_by_token", {
          p_public_token: publicToken,
          p_campaign: campaign,
          p_screens: screens,
        }, { accessToken }),
      setApproval: (managementToken, approved, accessToken) =>
        rpc("set_campaign_approval", {
          p_management_token: managementToken,
          p_approved: Boolean(approved),
        }, { accessToken }),
      updateManaged: (managementToken, campaign, screens, accessToken) =>
        rpc("update_campaign_managed", {
          p_management_token: managementToken,
          p_campaign: campaign,
          p_screens: screens,
        }, { accessToken }),
    }),
  });
})();
