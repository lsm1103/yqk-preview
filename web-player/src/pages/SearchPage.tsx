import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import VideoCard from "../components/VideoCard";
import { api } from "../lib/api";
import { stripAds, toVodId } from "../lib/format";
import type { ListData, SearchFilterData, VodItem } from "../types";

type TabKey = "keyword" | "filter";

type FilterSelection = Record<string, string>;

function buildQueryValueJson(selection: FilterSelection, sortType: number | null) {
  const list: Array<{ filterName: string; value: string }> = [];
  Object.entries(selection).forEach(([filterName, value]) => {
    if (value && value !== "__all__") list.push({ filterName, value });
  });
  if (sortType != null) list.push({ filterName: "sortType", value: String(sortType) });
  return JSON.stringify(list);
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKeyword = searchParams.get("q") ?? "";
  const initialChannelId = searchParams.get("channelId") ?? "";
  const initialTab: TabKey = searchParams.get("tab") === "filter" || initialChannelId ? "filter" : "keyword";

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [keyword, setKeyword] = useState(queryKeyword);
  const [searchResult, setSearchResult] = useState<ListData | null>(null);
  const [discoverResult, setDiscoverResult] = useState<ListData | null>(null);
  const [filterData, setFilterData] = useState<SearchFilterData | null>(null);
  const [selection, setSelection] = useState<FilterSelection>(
    initialChannelId ? { channelId: initialChannelId } : {}
  );
  const [activeSort, setActiveSort] = useState<number | null>(null);
  const [filterResult, setFilterResult] = useState<ListData | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [error, setError] = useState("");

  const initPage = useCallback(async () => {
    setLoadingInit(true);
    try {
      const [filters, discover] = await Promise.all([api.getSearchFilter(), api.queryNow()]);
      setFilterData(filters);
      setDiscoverResult(discover);
      const defaultSort = filters.sortList?.find((item) => item.hasDefault);
      if (defaultSort) setActiveSort(defaultSort.sortType);
    } catch (err) {
      setError(String((err as Error).message || err));
    } finally {
      setLoadingInit(false);
    }
  }, []);

  useEffect(() => {
    void initPage();
  }, [initPage]);

  const runSearch = useCallback(
    async (targetKeyword: string, nextVal = "", append = false) => {
      if (!targetKeyword.trim()) return;
      setLoadingSearch(true);
      setError("");
      try {
        const data = await api.search({ keyword: targetKeyword.trim(), nextVal });
        setSearchResult((prev) => {
          if (!append || !prev) return data;
          return { ...data, items: [...prev.items, ...data.items] };
        });
      } catch (err) {
        setError(String((err as Error).message || err));
      } finally {
        setLoadingSearch(false);
      }
    },
    []
  );

  useEffect(() => {
    setKeyword(queryKeyword);
    if (queryKeyword.trim()) {
      void runSearch(queryKeyword);
    } else {
      setSearchResult(null);
    }
  }, [queryKeyword, runSearch]);

  const runFilter = useCallback(
    async (nextVal = "", append = false) => {
      setLoadingFilter(true);
      setError("");
      try {
        const data = await api.queryNow({
          nextVal,
          queryValueJson: buildQueryValueJson(selection, activeSort)
        });
        setFilterResult((prev) => {
          if (!append || !prev) return data;
          return { ...data, items: [...prev.items, ...data.items] };
        });
      } catch (err) {
        setError(String((err as Error).message || err));
      } finally {
        setLoadingFilter(false);
      }
    },
    [selection, activeSort]
  );

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = keyword.trim();
    if (!value) {
      setSearchParams({ tab: "keyword" });
      setSearchResult(null);
      return;
    }
    setSearchParams({ q: value, tab: "keyword" });
    await runSearch(value);
  };

  const openVod = async (item: VodItem) => {
    const vodId = toVodId(item.vodId);
    if (!vodId) return;
    await api.searchClick(vodId);
    navigate(`/watch/${vodId}`);
  };

  const changeTab = (tab: TabKey) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next);
  };

  const updateSelection = (filterName: string, value: string) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (!value || value === "__all__") delete next[filterName];
      else next[filterName] = value;
      return next;
    });
  };

  const clearFilters = () => {
    setSelection({});
    const def = filterData?.sortList?.find((item) => item.hasDefault);
    setActiveSort(def?.sortType ?? null);
    setFilterResult(null);
  };

  const searchResultsFiltered = useMemo(() => stripAds(searchResult?.items), [searchResult]);
  const discoverFiltered = useMemo(() => stripAds(discoverResult?.items), [discoverResult]);
  const filterItemsFiltered = useMemo(() => stripAds(filterResult?.items), [filterResult]);

  const searchHasNext = Boolean(searchResult?.hasNext && searchResult.nextVal);
  const filterHasNext = Boolean(filterResult?.hasNext && filterResult.nextVal);
  const discoverHasNext = Boolean(discoverResult?.hasNext && discoverResult.nextVal);

  const selectionCount = Object.values(selection).filter((v) => v && v !== "__all__").length;

  return (
    <div className="atv-page atv-page-search">
      <section className="atv-search-hero">
        <span className="atv-hero-eyebrow">发现</span>
        <h1 className="atv-search-title">想看点什么？</h1>
        <p className="atv-search-sub">支持关键词搜索，也能按分类、地区、年份进行精细筛选。</p>

        <div className="atv-search-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "keyword"}
            className={activeTab === "keyword" ? "atv-tab active" : "atv-tab"}
            onClick={() => changeTab("keyword")}
          >
            关键词
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "filter"}
            className={activeTab === "filter" ? "atv-tab active" : "atv-tab"}
            onClick={() => changeTab("filter")}
          >
            分类筛选
            {selectionCount ? <span className="atv-tab-badge">{selectionCount}</span> : null}
          </button>
        </div>
      </section>

      {error ? <p className="atv-state error">请求失败：{error}</p> : null}

      {activeTab === "keyword" ? (
        <div className="atv-page-body">
          <form className="atv-search-form" onSubmit={handleSearch}>
            <span className="atv-search-icon">⌕</span>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索片名、演员、关键词"
            />
            <button type="submit" disabled={loadingSearch}>
              {loadingSearch ? "搜索中" : "搜索"}
            </button>
          </form>

          {searchResult ? (
            <section className="atv-section">
              <header className="atv-section-head">
                <h2>搜索结果 · {queryKeyword || keyword}</h2>
                <span>{searchResultsFiltered.length} 个结果</span>
              </header>
              <div className="atv-grid">
                {searchResultsFiltered.map((item) => (
                  <VideoCard key={`search-${item.vodId}-${item.vodName}`} item={item} onClick={openVod} />
                ))}
              </div>
              {searchResultsFiltered.length === 0 ? (
                <p className="atv-state">暂无匹配结果</p>
              ) : null}
              {searchHasNext ? (
                <button
                  className="atv-load-more"
                  disabled={loadingSearch}
                  onClick={() => void runSearch(queryKeyword || keyword, searchResult.nextVal, true)}
                >
                  {loadingSearch ? "加载中..." : "加载更多"}
                </button>
              ) : null}
            </section>
          ) : (
            <section className="atv-section">
              <header className="atv-section-head">
                <h2>发现推荐</h2>
              </header>
              {loadingInit ? (
                <p className="atv-state">加载中...</p>
              ) : (
                <>
                  <div className="atv-grid">
                    {discoverFiltered.map((item) => (
                      <VideoCard key={`discover-${item.vodId}-${item.vodName}`} item={item} onClick={openVod} />
                    ))}
                  </div>
                  {discoverHasNext ? (
                    <button
                      className="atv-load-more"
                      onClick={async () => {
                        if (!discoverResult?.nextVal) return;
                        setLoadingSearch(true);
                        try {
                          const next = await api.queryNow({ nextVal: discoverResult.nextVal });
                          setDiscoverResult((prev) =>
                            prev ? { ...next, items: [...prev.items, ...next.items] } : next
                          );
                        } catch (err) {
                          setError(String((err as Error).message || err));
                        } finally {
                          setLoadingSearch(false);
                        }
                      }}
                    >
                      {loadingSearch ? "加载中..." : "加载更多推荐"}
                    </button>
                  ) : null}
                </>
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="atv-page-body">
          {loadingInit || !filterData ? (
            <p className="atv-state">筛选选项加载中...</p>
          ) : (
            <>
              <section className="atv-filter-card">
                <header className="atv-filter-head">
                  <h3>筛选条件</h3>
                  <button className="atv-btn atv-btn-ghost atv-btn-sm" onClick={clearFilters}>
                    重置
                  </button>
                </header>
                <div className="atv-filter-body">
                  {filterData.filterList.map((filter) => {
                    const current = selection[filter.filterName] ?? "__all__";
                    return (
                      <div key={filter.filterName} className="atv-filter-row">
                        <div className="atv-filter-label">{filter.filterName}</div>
                        <div className="atv-filter-chips">
                          <button
                            className={current === "__all__" ? "atv-pill active" : "atv-pill"}
                            onClick={() => updateSelection(filter.filterName, "__all__")}
                          >
                            全部
                          </button>
                          {filter.filterValueList.map((opt) => (
                            <button
                              key={opt.id}
                              className={current === opt.id ? "atv-pill active" : "atv-pill"}
                              onClick={() => updateSelection(filter.filterName, opt.id)}
                            >
                              {opt.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {filterData.sortList?.length ? (
                    <div className="atv-filter-row">
                      <div className="atv-filter-label">排序</div>
                      <div className="atv-filter-chips">
                        {filterData.sortList.map((sort) => (
                          <button
                            key={sort.sortType}
                            className={activeSort === sort.sortType ? "atv-pill active" : "atv-pill"}
                            onClick={() => setActiveSort(sort.sortType)}
                          >
                            {sort.sortName}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="atv-filter-actions">
                    <button
                      className="atv-btn atv-btn-primary"
                      disabled={loadingFilter}
                      onClick={() => void runFilter()}
                    >
                      {loadingFilter ? "筛选中..." : "应用筛选"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="atv-section">
                <header className="atv-section-head">
                  <h2>{filterResult ? "筛选结果" : "热门推荐"}</h2>
                  {filterResult ? <span>{filterItemsFiltered.length} 个结果</span> : null}
                </header>
                <div className="atv-grid">
                  {(filterResult ? filterItemsFiltered : discoverFiltered).map((item) => (
                    <VideoCard key={`f-${item.vodId}-${item.vodName}`} item={item} onClick={openVod} />
                  ))}
                </div>
                {filterResult && filterItemsFiltered.length === 0 ? (
                  <p className="atv-state">当前筛选无结果，换一组条件试试</p>
                ) : null}
                {filterResult && filterHasNext ? (
                  <button
                    className="atv-load-more"
                    disabled={loadingFilter}
                    onClick={() => void runFilter(filterResult.nextVal, true)}
                  >
                    {loadingFilter ? "加载中..." : "加载更多"}
                  </button>
                ) : null}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
