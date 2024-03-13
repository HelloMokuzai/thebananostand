import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { NanoClient } from '@dev-ptera/nano-node-rpc';
import { AppStateService } from '@app/services/app-state.service';
import { SELECTED_RPC_DATASOURCE_CHANGE } from '@app/services/wallet-events.service';

export type Datasource = {
    alias: 'Batman' | 'Creeper' | 'Jungle Tv' | 'Booster' | 'Kalium' | 'Rain City' | string;
    url: string;
    isAccessible: boolean;
    isSelected: boolean;
    isAddedByUser?: boolean;
};

@Injectable({
    providedIn: 'root',
})

/** Returns which datasource we should use, for RPC nodes & Spyglass API. */
export class DatasourceService {
    availableSpyglassApiSources: Datasource[] = [
        {
            alias: 'Batman',
            url: 'https://api.spyglass.pw/banano',
            isAccessible: false,
            isSelected: false,
        },
        {
            alias: 'Creeper',
            url: 'https://api.creeper.banano.cc/banano',
            isAccessible: false,
            isSelected: false,
        },
    ];

    availableRpcDataSources: Datasource[] = [
        /* { alias: 'Vault', url: 'https://vault.banano.cc/api/node-api', isAccessible: false, isSelected: false }, */ // CORS error
        /* { alias: 'Jungle TV', url: 'https://public.node.jungletv.live/rpc', isAccessible: false, isSelected: false }, */ // Can't do work_generate
        { alias: 'Booster', url: 'https://booster.dev-ptera.com/banano-rpc', isAccessible: false, isSelected: false },
        { alias: 'Kalium', url: 'https://kaliumapi.appditto.com/api', isAccessible: false, isSelected: false },
        // { alias: 'Rain City', url: 'https://rainstorm.city/api', isAccessible: false, isSelected: false } // Nano node, but can generate work (?)
    ];

    defaultRpcDataSource: Datasource;
    customRpcDataSources: Datasource[] = [];

    private rpcNode: NanoClient;
    private rpcSource: Datasource;
    private readonly rpcSourceLoadedSubject = new Subject<Datasource>();

    private spyglassApiSource: Datasource;
    private readonly spyglassSourceLoadedSubject = new Subject<Datasource>();

    constructor(http: HttpClient, state: AppStateService) {
        const handleError = (err, url): void => {
            console.error(`${url} is inaccessible as a datasource, ignoring it.`);
            console.error(err);
        };

        state.store.subscribe((data) => {
            if (!data.customRpcNodeURLs || data.customRpcNodeURLs.length === this.customRpcDataSources.length) {
                return;
            }

            this.customRpcDataSources = [];
            data.customRpcNodeURLs.map((customSourceUrl, index) => {
                const newSource = {
                    isSelected: false,
                    isAccessible: true,
                    isAddedByUser: true,
                    alias: `Custom node #${index + 1}`,
                    url: customSourceUrl,
                };
                this.customRpcDataSources.push(newSource);
            });

            /** When a custom datasource is added, we will set it as the selected RPC datasource.
             *  There is currently no check in place, within the component, to check to see if the datasource is online when adding it.
             * */
            this.setRpcSource(
                this.customRpcDataSources[this.customRpcDataSources.length - 1] || this.defaultRpcDataSource
            );
        });

        // Ping available RPC Sources
        this.availableRpcDataSources.map((source: Datasource) => {
            http.post(source.url, { action: 'block_count' })
                .toPromise()
                .then(() => {
                    source.isAccessible = true;
                    /** We want to default the RPC node to Kalium since it is configured to work with Boom-PoW. */
                    if (!this.rpcSource || (source.alias === 'Kalium' && !this._isCustomSource(this.rpcSource))) {
                        // eslint-disable-next-line no-console
                        console.log(`Using ${source.alias} as RPC source.`);
                        this.setRpcSource(source);
                        this.defaultRpcDataSource = source;
                        this.rpcSourceLoadedSubject.next(source);
                    }
                })
                .catch((err) => handleError(err, source.url));
        });

        // Ping available Spyglass API sources
        this.availableSpyglassApiSources.map((source) => {
            http.get<any>(`${source.url}/v1/representatives/online`)
                .toPromise()
                .then(() => {
                    source.isAccessible = true;
                    if (!this.spyglassApiSource) {
                        // eslint-disable-next-line no-console
                        console.log(`Using ${source.alias} as Spyglass API source.`);
                        this.setSpyglassApiSource(source);
                        this.spyglassSourceLoadedSubject.next(source);
                    }
                })
                .catch((err) => handleError(err, source.url));
        });
    }

    private _isCustomSource(source: Datasource): boolean {
        return source && source.alias.includes('Custom');
    }

    setRpcSource(source: Datasource): void {
        if (this.rpcSource) {
            this.rpcSource.isSelected = false;
        }
        source.isSelected = true;
        this.rpcSource = source;
        this.rpcNode = new NanoClient({
            url: source.url,
        });
        SELECTED_RPC_DATASOURCE_CHANGE.next(this.rpcSource);
    }

    setSpyglassApiSource(source: Datasource): void {
        if (this.spyglassApiSource) {
            this.spyglassApiSource.isSelected = false;
        }
        source.isSelected = true;
        this.spyglassApiSource = source;
    }

    async getRpcClient(): Promise<NanoClient> {
        if (this.rpcNode) {
            return Promise.resolve(this.rpcNode);
        }
        const source = await this.getRpcSource();
        return new NanoClient({
            url: source.url,
        });
    }

    /** The source is only known once one of the servers respond. */
    getSpyglassApiSource(): Promise<Datasource> {
        return new Promise((resolve) => {
            if (this.spyglassApiSource) {
                resolve(this.spyglassApiSource);
            } else {
                this.spyglassSourceLoadedSubject.subscribe((source) => {
                    resolve(source);
                });
            }
        });
    }

    /** The source is only known once one of the servers respond. */
    getRpcSource(): Promise<Datasource> {
        return new Promise((resolve) => {
            if (this.rpcSource) {
                resolve(this.rpcSource);
            } else {
                this.rpcSourceLoadedSubject.subscribe((source) => {
                    resolve(source);
                });
            }
        });
    }
}
