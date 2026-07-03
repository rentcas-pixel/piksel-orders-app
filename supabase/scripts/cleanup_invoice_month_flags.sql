-- =============================================================================
-- Valymas: klaidingos sąskaitų būsenos (order_invoice_month_flags + legacy)
--
-- Kontekstas: senesnė logika su „Visi + metai“ filtru galėjo įrašyti tas pačias
-- vėliavas į VISUS kampanijos mėnesius. Nauja logika naudoja tik konkretų mėnesį.
--
-- KAIP NAUDOTI (Supabase → SQL Editor):
--   1. Paleisk tik 1 dalį (PERŽIŪRA) – įsitikink, kad rezultatai atrodo teisingai.
--   2. Jei reikia – paleisk 2 dalį (VALYMAS) vienoje transakcijoje.
--   3. Pasirinktinai – 3 dalis konkretiems testiniams order_id.
--
-- Pastaba: rankinės vėliavos BE sąskaitos (tikras rankinis žymėjimas) taip pat
-- pateks į „be coverage“ sąrašą. Jei tokių turite sąmoningai – išimkite order_id
-- iš valymo arba naudokite tik 3 dalį.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. PERŽIŪRA (saugiai – nieko nekeičia)
-- -----------------------------------------------------------------------------

-- 1a. Bulk įrašai: keli mėnesiai tam pačiam užsakymui + metai + updated_at
SELECT
  f.order_id,
  f.billing_year,
  f.updated_at,
  COUNT(*) AS month_row_count,
  BOOL_OR(f.invoice_issued) AS any_issued,
  BOOL_OR(f.invoice_sent) AS any_sent,
  ARRAY_AGG(f.billing_month ORDER BY f.billing_month) AS months
FROM order_invoice_month_flags f
GROUP BY f.order_id, f.billing_year, f.updated_at
HAVING COUNT(*) >= 2
ORDER BY f.updated_at DESC;


-- 1b. Mėnesių vėliavos be sąskaitos coverage tame mėnesyje
WITH invoice_month_coverage AS (
  SELECT DISTINCT
    src.order_id,
    EXTRACT(YEAR FROM m.month_date)::INT AS billing_year,
    EXTRACT(MONTH FROM m.month_date)::INT AS billing_month
  FROM (
    SELECT
      i.order_id,
      COALESCE(i.period_from::DATE, i.invoice_date::DATE) AS range_from,
      COALESCE(i.period_to::DATE, i.invoice_date::DATE) AS range_to
    FROM invoices i
    WHERE i.order_id IS NOT NULL
      AND i.order_id NOT LIKE 'combined-%'
      AND i.order_id NOT LIKE 'standalone-%'

    UNION ALL

    SELECT
      il.order_id,
      COALESCE(il.period_from::DATE, i.period_from::DATE, i.invoice_date::DATE) AS range_from,
      COALESCE(il.period_to::DATE, i.period_to::DATE, i.invoice_date::DATE) AS range_to
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    WHERE il.order_id IS NOT NULL
  ) src
  CROSS JOIN LATERAL generate_series(
    DATE_TRUNC('month', src.range_from),
    DATE_TRUNC('month', src.range_to),
    INTERVAL '1 month'
  ) AS m(month_date)
  WHERE src.range_from IS NOT NULL
    AND src.range_to IS NOT NULL
),
flagged AS (
  SELECT
    f.order_id,
    f.billing_year,
    f.billing_month,
    f.invoice_issued,
    f.invoice_sent,
    f.updated_at
  FROM order_invoice_month_flags f
  WHERE f.invoice_issued OR f.invoice_sent
)
SELECT
  fl.order_id,
  fl.billing_year,
  fl.billing_month,
  fl.invoice_issued,
  fl.invoice_sent,
  fl.updated_at,
  CASE
    WHEN bg.order_id IS NOT NULL THEN 'bulk_group'
    ELSE 'single'
  END AS likely_source
FROM flagged fl
LEFT JOIN invoice_month_coverage cov
  ON cov.order_id = fl.order_id
 AND cov.billing_year = fl.billing_year
 AND cov.billing_month = fl.billing_month
LEFT JOIN (
  SELECT order_id, billing_year, updated_at
  FROM order_invoice_month_flags
  GROUP BY order_id, billing_year, updated_at
  HAVING COUNT(*) >= 2
) bg
  ON bg.order_id = fl.order_id
 AND bg.billing_year = fl.billing_year
 AND bg.updated_at = fl.updated_at
WHERE cov.order_id IS NULL
ORDER BY fl.order_id, fl.billing_year, fl.billing_month;


-- 1c. Legacy būsena užsakymams, kurie turi kelias mėnesio vėliavas (neturėtų naudoti legacy)
SELECT
  ois.order_id,
  ois.invoice_issued,
  ois.invoice_sent,
  ois.updated_at,
  COUNT(f.billing_month) AS month_flag_count
FROM order_invoice_status ois
JOIN order_invoice_month_flags f ON f.order_id = ois.order_id
GROUP BY ois.order_id, ois.invoice_issued, ois.invoice_sent, ois.updated_at
HAVING COUNT(DISTINCT (f.billing_year, f.billing_month)) >= 2
ORDER BY ois.updated_at DESC;


-- -----------------------------------------------------------------------------
-- 2. VALYMAS (paleisti tik po peržiūros)
-- -----------------------------------------------------------------------------

BEGIN;

-- 2a. Iš bulk grupių pašalinti mėnesius BE sąskaitos coverage
WITH invoice_month_coverage AS (
  SELECT DISTINCT
    src.order_id,
    EXTRACT(YEAR FROM m.month_date)::INT AS billing_year,
    EXTRACT(MONTH FROM m.month_date)::INT AS billing_month
  FROM (
    SELECT
      i.order_id,
      COALESCE(i.period_from::DATE, i.invoice_date::DATE) AS range_from,
      COALESCE(i.period_to::DATE, i.invoice_date::DATE) AS range_to
    FROM invoices i
    WHERE i.order_id IS NOT NULL
      AND i.order_id NOT LIKE 'combined-%'
      AND i.order_id NOT LIKE 'standalone-%'

    UNION ALL

    SELECT
      il.order_id,
      COALESCE(il.period_from::DATE, i.period_from::DATE, i.invoice_date::DATE) AS range_from,
      COALESCE(il.period_to::DATE, i.period_to::DATE, i.invoice_date::DATE) AS range_to
    FROM invoice_lines il
    JOIN invoices i ON i.id = il.invoice_id
    WHERE il.order_id IS NOT NULL
  ) src
  CROSS JOIN LATERAL generate_series(
    DATE_TRUNC('month', src.range_from),
    DATE_TRUNC('month', src.range_to),
    INTERVAL '1 month'
  ) AS m(month_date)
  WHERE src.range_from IS NOT NULL
    AND src.range_to IS NOT NULL
),
bulk_groups AS (
  SELECT order_id, billing_year, updated_at
  FROM order_invoice_month_flags
  GROUP BY order_id, billing_year, updated_at
  HAVING COUNT(*) >= 2
),
to_remove AS (
  SELECT f.order_id, f.billing_year, f.billing_month
  FROM order_invoice_month_flags f
  JOIN bulk_groups b
    ON b.order_id = f.order_id
   AND b.billing_year = f.billing_year
   AND b.updated_at = f.updated_at
  LEFT JOIN invoice_month_coverage cov
    ON cov.order_id = f.order_id
   AND cov.billing_year = f.billing_year
   AND cov.billing_month = f.billing_month
  WHERE cov.order_id IS NULL
    AND (f.invoice_issued OR f.invoice_sent)
)
DELETE FROM order_invoice_month_flags f
USING to_remove r
WHERE f.order_id = r.order_id
  AND f.billing_year = r.billing_year
  AND f.billing_month = r.billing_month;


-- 2b. Pašalinti tuščias eilutes (abu false)
DELETE FROM order_invoice_month_flags
WHERE NOT invoice_issued
  AND NOT invoice_sent;


-- 2c. Nuimti legacy žymėjimą užsakymams su keliomis mėnesio vėliavomis
UPDATE order_invoice_status ois
SET
  invoice_issued = FALSE,
  invoice_sent = FALSE,
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM order_invoice_month_flags f
  WHERE f.order_id = ois.order_id
  GROUP BY f.order_id
  HAVING COUNT(DISTINCT (f.billing_year, f.billing_month)) >= 2
)
AND (ois.invoice_issued OR ois.invoice_sent);

-- Peržiūrėk rezultatą prieš COMMIT. Jei ne taip – ROLLBACK;
-- COMMIT;
ROLLBACK;  -- ← pakeisk į COMMIT; kai patvirtinsi


-- -----------------------------------------------------------------------------
-- 3. PASIRINKTINIS valymas konkretiems testiniams užsakymams
-- -----------------------------------------------------------------------------
-- Pvz. order 4887 (PocketBase id):
--   p223e8m113r6504
--
-- BEGIN;
-- DELETE FROM order_invoice_month_flags
-- WHERE order_id IN (
--   'p223e8m113r6504'  -- pridėk kitus testinius order_id
-- );
-- UPDATE order_invoice_status
-- SET invoice_issued = FALSE, invoice_sent = FALSE, updated_at = NOW()
-- WHERE order_id IN (
--   'p223e8m113r6504'
-- );
-- COMMIT;


-- -----------------------------------------------------------------------------
-- 4. Po valymo – pakartotinė peržiūra
-- -----------------------------------------------------------------------------
-- Paleisk dar kartą 1a, 1b, 1c ir patikrink Užsakymų lentelę su skirtingais filtrais.
