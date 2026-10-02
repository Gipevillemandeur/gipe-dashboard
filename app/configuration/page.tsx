                    }}
                  >
                    La trésorerie sera intégrée ultérieurement.
                  </div>

                </div>

                <div style={{ marginTop: 22 }}>

                  <label
                    htmlFor="new-school-year"
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 7,
                    }}
                  >
                    Nouvelle année scolaire
                  </label>

                  <input
                    id="new-school-year"
                    type="text"
                    value={newYearLabel}
                    onChange={(event) =>
                      setNewYearLabel(event.target.value)
                    }
                    placeholder="2027-2028"
                    className="input"
                    autoFocus
                    disabled={closing}
                  />

                </div>

                {confirmClosure && (

                  <div
                    style={{
                      marginTop: 16,
                      padding: 14,
                      borderRadius: 10,
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      color: '#9a3412',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Dernière vérification</strong>
                    <br />
                    Tu vas clôturer{' '}
                    <strong>{closurePreview.schoolYear}</strong>{' '}
                    et créer l’année{' '}
                    <strong>{newYearLabel || '—'}</strong>.
                    <br />
                    <br />
                    Le bilan sera enregistré et l’ancienne année
                    passera dans l’historique.
                  </div>

                )}

                {error && (

                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 10,
                      background: '#fef2f2',
                      color: '#b91c1c',
                      fontSize: 13,
                    }}
                  >
                    {error}
                  </div>

                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 10,
                    marginTop: 24,
                  }}
                >

                  <button
                    type="button"
                    className="btn"
                    onClick={closeClosure}
                    disabled={closing}
                  >
                    Annuler
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleClosure}
                    disabled={closing}
                  >
                    {closing
                      ? 'Clôture en cours…'
                      : confirmClosure
                        ? 'Clôturer définitivement'
                        : 'Continuer vers la confirmation'}
                  </button>

                </div>

              </>

            ) : null}

          </div>

        </div>

      )}

    </>
  );
}
